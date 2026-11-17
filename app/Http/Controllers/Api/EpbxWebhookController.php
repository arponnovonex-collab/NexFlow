<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\EpbxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EpbxWebhookController extends Controller
{
    public function __construct(protected EpbxService $epbxService)
    {
    }

    /**
     * Handle incoming ePBX.bd webhook events (CDR, call status, recording).
     */
    public function handle(Request $request): JsonResponse
    {
        $payload = array_merge($request->query(), $request->all());
        if (empty($payload) || count($payload) === count($request->query())) {
            $rawContent = $request->getContent();
            $decoded = json_decode($rawContent, true);
            if (is_array($decoded)) {
                $payload = array_merge($request->query(), $decoded);
            }
        }

        Log::info('ePBX Webhook Received:', $payload);

        try {
            \App\Models\WebhookEvent::create([
                'platform' => 'epbx',
                'event_type' => (string) ($payload['status'] ?? ($payload['digit_pressed'] ?? ($payload['event'] ?? 'call_callback'))),
                'payload' => $payload,
            ]);
        } catch (\Throwable) {
            // Ignore if WebhookEvent fails
        }

        try {
            $processed = $this->epbxService->processWebhook($payload);

            return response()->json([
                'status' => 'success',
                'processed' => $processed,
            ], 200);
        } catch (\Throwable $e) {
            Log::error('ePBX Webhook Processing Error: ' . $e->getMessage());

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}

