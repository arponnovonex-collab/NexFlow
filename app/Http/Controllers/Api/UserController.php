<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * List all team members / moderators.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with(['assignedSocialAccounts:id,platform,name'])
            ->withCount(['assignedConversations', 'assignedLeads', 'followups']);

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name')->paginate($request->integer('per_page', 15));

        return response()->json([
            'status' => 'success',
            'data' => $users,
        ]);
    }

    /**
     * Create a new team member / moderator.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in(['super_admin', 'admin', 'moderator'])],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'phone' => 'nullable|string|max:50',
            'social_account_ids' => 'nullable|array',
            'social_account_ids.*' => 'exists:social_accounts,id',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => $validated['status'] ?? 'active',
            'phone' => $validated['phone'] ?? null,
        ]);

        if (! empty($validated['social_account_ids'])) {
            $user->assignedSocialAccounts()->sync($validated['social_account_ids']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Team member created successfully',
            'user' => $user->load('assignedSocialAccounts'),
        ], 201);
    }

    /**
     * Show single user details.
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['assignedSocialAccounts', 'loginHistories' => function ($q) {
            $q->latest('login_at')->limit(10);
        }])->loadCount(['assignedConversations', 'assignedLeads', 'followups', 'orders']);

        return response()->json([
            'status' => 'success',
            'user' => $user,
        ]);
    }

    /**
     * Update user details and assignments.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'role' => ['sometimes', 'required', Rule::in(['super_admin', 'admin', 'moderator'])],
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive'])],
            'phone' => 'nullable|string|max:50',
            'social_account_ids' => 'nullable|array',
            'social_account_ids.*' => 'exists:social_accounts,id',
        ]);

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        if (isset($validated['social_account_ids'])) {
            $user->assignedSocialAccounts()->sync($validated['social_account_ids']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Team member updated successfully',
            'user' => $user->load('assignedSocialAccounts'),
        ]);
    }

    /**
     * Deactivate / delete a user.
     */
    public function destroy(User $user): JsonResponse
    {
        if ($user->isSuperAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cannot delete the Super Admin account.',
            ], 403);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Team member deleted successfully',
        ]);
    }
}

