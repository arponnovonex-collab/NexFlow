<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\LeadFollowup;
use App\Models\LeadStatusHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeadController extends Controller
{
    /**
     * List leads with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Lead::with([
            'customer:id,name,email,phone,avatar_url',
            'conversation.socialAccount:id,platform,name',
            'assignedUser:id,name',
            'relatedProduct:id,name,selling_price',
            'followups' => function ($q) {
                $q->latest('followup_date')->limit(1);
            },
        ]);

        if ($user->isModerator()) {
            $query->where('assigned_to_user_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('assigned_to_user_id')) {
            $query->where('assigned_to_user_id', $request->assigned_to_user_id);
        }

        if ($request->filled('platform')) {
            $query->whereHas('conversation', function ($q) use ($request) {
                $q->where('platform', $request->platform);
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('customer', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $leads = $query->orderByDesc('updated_at')->paginate($request->integer('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $leads,
        ]);
    }

    /**
     * Update lead status with audit history.
     */
    public function updateStatus(Request $request, Lead $lead): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:cold,warm,hot,converted,lost',
            'reason' => 'nullable|string',
            'related_product_id' => 'nullable|exists:products,id',
        ]);

        $prevStatus = $lead->status;
        $user = $request->user();

        DB::transaction(function () use ($lead, $validated, $prevStatus, $user) {
            $lead->update([
                'status' => $validated['status'],
                'related_product_id' => $validated['related_product_id'] ?? $lead->related_product_id,
                'last_status_change_at' => now(),
            ]);

            LeadStatusHistory::create([
                'lead_id' => $lead->id,
                'previous_status' => $prevStatus,
                'new_status' => $validated['status'],
                'changed_by_user_id' => $user->id,
                'source' => 'manual',
                'reason' => $validated['reason'] ?? 'Updated by moderator from inbox',
            ]);
        });

        return response()->json([
            'status' => 'success',
            'message' => "Lead transitioned from {$prevStatus} to {$validated['status']}",
            'data' => $lead->fresh(['customer', 'relatedProduct', 'statusHistories.changedByUser']),
        ]);
    }

    /**
     * List follow-ups with due and overdue filters.
     */
    public function followups(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = LeadFollowup::with(['lead.customer', 'lead.relatedProduct', 'conversation', 'user:id,name']);

        if ($user->isModerator()) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date')) {
            $query->where('followup_date', $request->date);
        }

        $followups = $query->orderBy('followup_date', 'asc')->paginate($request->integer('per_page', 25));

        return response()->json([
            'status' => 'success',
            'data' => $followups,
        ]);
    }

    /**
     * Schedule a new follow-up.
     */
    public function storeFollowup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lead_id' => 'required|exists:leads,id',
            'conversation_id' => 'nullable|exists:conversations,id',
            'followup_date' => 'required|date',
            'followup_time' => 'nullable|string',
            'notes' => 'required|string',
            'priority' => 'required|in:low,medium,high',
        ]);

        $user = $request->user();
        $isToday = $validated['followup_date'] === now()->toDateString();

        $followup = LeadFollowup::create([
            ...$validated,
            'user_id' => $user->id,
            'status' => $isToday ? 'due_today' : 'scheduled',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Follow-up scheduled successfully',
            'data' => $followup->load(['lead.customer', 'user']),
        ], 201);
    }

    /**
     * Complete or update follow-up status.
     */
    public function updateFollowup(Request $request, LeadFollowup $followup): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:scheduled,due_today,overdue,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        $followup->update([
            'status' => $validated['status'],
            'notes' => $validated['notes'] ?? $followup->notes,
            'completed_at' => $validated['status'] === 'completed' ? now() : null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Follow-up updated successfully',
            'data' => $followup,
        ]);
    }

    /**
     * List customers directory.
     */
    public function customers(Request $request): JsonResponse
    {
        $query = Customer::withCount(['conversations', 'leads', 'orders'])->with(['channelIdentities']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $customers = $query->orderBy('name')->paginate($request->integer('per_page', 20));

        return response()->json([
            'status' => 'success',
            'data' => $customers,
        ]);
    }

    /**
     * Update customer details.
     */
    public function updateCustomer(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string',
        ]);

        $customer->update(array_filter($validated, fn ($val) => ! is_null($val)));

        if (! empty($validated['name'])) {
            $customer->channelIdentities()->update(['profile_name' => $validated['name']]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Customer details updated successfully',
            'data' => $customer->fresh(['channelIdentities']),
        ]);
    }
}

