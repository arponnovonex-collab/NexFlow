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
        $payload = $request->all();
        Log::info('ePBX Webhook Received:', $payload);

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

