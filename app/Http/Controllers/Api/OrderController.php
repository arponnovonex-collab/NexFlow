<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CourierSetting;
use App\Models\Lead;
use App\Models\LeadStatusHistory;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Services\BulkSmsService;
use App\Services\SteadfastCourierService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /**
     * List all orders.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'product', 'variant', 'user:id,name']);

        $problemIds = [];
        if ($request->boolean('problem_free')) {
            // Exclude cancelled by default unless explicitly requested
            if (! $request->filled('order_status')) {
                $query->where('order_status', '!=', 'cancelled');
            }

            // Exclude orders with unverified duplicate or multi-qty problems
            $problemIds = $this->getUnresolvedProblemOrderIds(15);
            if (! empty($problemIds)) {
                $query->whereNotIn('id', $problemIds);
            }
        }

        if ($request->filled('order_status')) {
            $query->where('order_status', $request->order_status);
        }

        if ($request->filled('source')) {
            $source = $request->source;
            if ($source === 'engagement') {
                $query->where(function ($sq) {
                    $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                        ->orWhereNull('order_source')
                        ->orWhere('order_source', '!=', 'woocommerce');
                });
            } elseif ($source === 'website') {
                $query->whereIn('order_source', ['woocommerce', 'web']);
            }
        }

        if ($request->filled('date')) {
            $dt = Carbon::parse($request->date, 'Asia/Dhaka');
            $startUtc = $dt->copy()->startOfDay()->setTimezone('UTC');
            $endUtc = $dt->copy()->endOfDay()->setTimezone('UTC');
            $query->where(function ($q) use ($startUtc, $endUtc, $request) {
                $q->whereBetween('created_at', [$startUtc, $endUtc])
                  ->orWhereDate('created_at', $request->date);
            });
        } elseif ($request->filled('start_date') || $request->filled('end_date')) {
            $startUtc = $request->filled('start_date')
                ? Carbon::parse($request->start_date, 'Asia/Dhaka')->startOfDay()->setTimezone('UTC')
                : Carbon::create(2020, 1, 1);
            $endUtc = $request->filled('end_date')
                ? Carbon::parse($request->end_date, 'Asia/Dhaka')->endOfDay()->setTimezone('UTC')
                : Carbon::now('Asia/Dhaka')->endOfDay()->setTimezone('UTC');
            $sDate = $request->input('start_date', '2020-01-01');
            $eDate = $request->input('end_date', Carbon::now('Asia/Dhaka')->format('Y-m-d'));
            $query->where(function ($q) use ($startUtc, $endUtc, $sDate, $eDate) {
                $q->whereBetween('created_at', [$startUtc, $endUtc])
                  ->orWhereBetween(DB::raw('DATE(created_at)'), [$sDate, $eDate]);
            });
        }

        if ($request->filled('search')) {
            $rawSearch = trim($request->search);
            $cleanDigits = preg_replace('/[^0-9]/', '', $rawSearch);
            $cleanNum = ltrim($rawSearch, '#');

            $query->where(function ($q) use ($rawSearch, $cleanDigits, $cleanNum) {
                // 1. Order number or WooCommerce ID match
                $q->where('order_number', 'like', "%{$rawSearch}%")
                    ->orWhere('order_number', 'like', "%{$cleanNum}%");

                if (! empty($cleanNum) && is_numeric($cleanNum)) {
                    $q->orWhere('wc_order_id', (int) $cleanNum);
                }

                // 2. Customer phone number match (with or without +880, 018...)
                $q->orWhere('customer_phone', 'like', "%{$rawSearch}%");
                if (! empty($cleanDigits)) {
                    $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                    $q->orWhere('customer_phone', 'like', "%{$cleanDigits}%")
                        ->orWhere('customer_phone', 'like', "%{$lastDigits}%");
                }

                // 3. Customer address & email match
                $q->orWhere('customer_address', 'like', "%{$rawSearch}%")
                    ->orWhere('customer_email', 'like', "%{$rawSearch}%")
                    ->orWhere('size', 'like', "%{$rawSearch}%")
                    ->orWhere('color', 'like', "%{$rawSearch}%");

                // 4. Linked Customer relation match (name or phone)
                $q->orWhereHas('customer', function ($cq) use ($rawSearch, $cleanDigits) {
                    $cq->where('name', 'like', "%{$rawSearch}%")
                        ->orWhere('phone', 'like', "%{$rawSearch}%");
                    if (! empty($cleanDigits)) {
                        $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                        $cq->orWhere('phone', 'like', "%{$cleanDigits}%")
                            ->orWhere('phone', 'like', "%{$lastDigits}%");
                    }
                });
            });
        }

        $perPage = $request->integer('per_page', 50);
        if ($perPage > 250) {
            $perPage = 250;
        }

        // For website / WooCommerce orders, strictly sequence by WooCommerce Order ID (wc_order_id DESC)
        // so that the order sequence perfectly matches the WooCommerce store admin.
        if ($request->query('source') === 'website') {
            $query->orderByDesc('wc_order_id')->orderByDesc('created_at');
        } else {
            $query->orderByDesc('created_at')->orderByDesc('id');
        }

        $orders = $query->paginate($perPage);

        // Attach Duplicate / Double Order detection & CX resolution status
        $this->attachDuplicateStatus($orders);

        $stats = null;
        if ($request->boolean('problem_free')) {
            $dateKey = $request->input('date', '') . '_' . $request->input('start_date', '') . '_' . $request->input('end_date', '');
            $stats = Cache::remember('problem_free_order_stats_' . md5($dateKey), 20, function () use ($problemIds, $request) {
                $baseQ = Order::where('order_status', '!=', 'cancelled')->whereNotIn('id', $problemIds);
                if ($request->filled('date')) {
                    $dt = Carbon::parse($request->date, 'Asia/Dhaka');
                    $baseQ->whereBetween('created_at', [
                        $dt->copy()->startOfDay()->setTimezone('UTC'),
                        $dt->copy()->endOfDay()->setTimezone('UTC'),
                    ]);
                } elseif ($request->filled('start_date') || $request->filled('end_date')) {
                    $startUtc = $request->filled('start_date')
                        ? Carbon::parse($request->start_date, 'Asia/Dhaka')->startOfDay()->setTimezone('UTC')
                        : Carbon::create(2020, 1, 1);
                    $endUtc = $request->filled('end_date')
                        ? Carbon::parse($request->end_date, 'Asia/Dhaka')->endOfDay()->setTimezone('UTC')
                        : Carbon::now('Asia/Dhaka')->endOfDay()->setTimezone('UTC');
                    $baseQ->whereBetween('created_at', [$startUtc, $endUtc]);
                }

                return [
                    'total' => (clone $baseQ)->count(),
                    'website' => (clone $baseQ)->whereIn('order_source', ['woocommerce', 'web'])->count(),
                    'engagement' => (clone $baseQ)->where(function ($sq) {
                        $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                            ->orWhereNull('order_source')
                            ->orWhere('order_source', '!=', 'woocommerce');
                    })->count(),
                    'confirmed' => (clone $baseQ)->where('order_status', 'confirmed')->count(),
                    'processing' => (clone $baseQ)->whereIn('order_status', ['processing', 'pending'])->count(),
                ];
            });
        }

        return response()->json([
            'status' => 'success',
            'data' => $orders,
            'stats' => $stats,
        ]);
    }

    /**
     * Export problem-free orders to CSV matching the standard courier format.
     * Header: Invoice, Name, Address, Phone, Amount, Note, Contact Name, Contact Phone, Lot, Delivery Type
     */
    public function exportProblemFree(Request $request)
    {
        $query = Order::with(['customer', 'product', 'variant', 'conversation.socialAccount']);

        if ($request->filled('statuses') && $request->statuses !== 'all') {
            $statusList = is_array($request->statuses)
                ? $request->statuses
                : explode(',', (string) $request->statuses);
            $statusList = array_filter(array_map('trim', $statusList));
            if (! empty($statusList)) {
                $query->whereIn('order_status', $statusList);
            }
        } elseif ($request->filled('order_status') && $request->order_status !== 'all') {
            $query->where('order_status', $request->order_status);
        } else {
            $query->where('order_status', '!=', 'cancelled');
        }

        if ($request->filled('order_ids')) {
            $ids = is_array($request->order_ids) ? $request->order_ids : explode(',', (string) $request->order_ids);
            $ids = array_filter(array_map('intval', $ids));
            if (! empty($ids)) {
                $query->whereIn('id', $ids);
            }
        } else {
            $problemIds = $this->getUnresolvedProblemOrderIds(15);
            if (! empty($problemIds)) {
                $query->whereNotIn('id', $problemIds);
            }

            if ($request->filled('source') && $request->source !== 'all') {
                $source = $request->source;
                if ($source === 'engagement') {
                    $query->where(function ($sq) {
                        $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                            ->orWhereNull('order_source')
                            ->orWhere('order_source', '!=', 'woocommerce');
                    });
                } elseif ($source === 'website') {
                    $query->whereIn('order_source', ['woocommerce', 'web']);
                }
            }

            if ($request->filled('date')) {
                $dt = Carbon::parse($request->date, 'Asia/Dhaka');
                $startUtc = $dt->copy()->startOfDay()->setTimezone('UTC');
                $endUtc = $dt->copy()->endOfDay()->setTimezone('UTC');
                $query->where(function ($q) use ($startUtc, $endUtc, $request) {
                    $q->whereBetween('created_at', [$startUtc, $endUtc])
                      ->orWhereDate('created_at', $request->date);
                });
            } elseif ($request->filled('start_date') || $request->filled('end_date')) {
                $startUtc = $request->filled('start_date')
                    ? Carbon::parse($request->start_date, 'Asia/Dhaka')->startOfDay()->setTimezone('UTC')
                    : Carbon::create(2020, 1, 1);
                $endUtc = $request->filled('end_date')
                    ? Carbon::parse($request->end_date, 'Asia/Dhaka')->endOfDay()->setTimezone('UTC')
                    : Carbon::now('Asia/Dhaka')->endOfDay()->setTimezone('UTC');
                $sDate = $request->input('start_date', '2020-01-01');
                $eDate = $request->input('end_date', Carbon::now('Asia/Dhaka')->format('Y-m-d'));
                $query->where(function ($q) use ($startUtc, $endUtc, $sDate, $eDate) {
                    $q->whereBetween('created_at', [$startUtc, $endUtc])
                      ->orWhereBetween(DB::raw('DATE(created_at)'), [$sDate, $eDate]);
                });
            }

            if ($request->filled('search')) {
                $rawSearch = trim($request->search);
                $cleanDigits = preg_replace('/[^0-9]/', '', $rawSearch);
                $cleanNum = ltrim($rawSearch, '#');

                $query->where(function ($q) use ($rawSearch, $cleanDigits, $cleanNum) {
                    $q->where('order_number', 'like', "%{$rawSearch}%")
                        ->orWhere('order_number', 'like', "%{$cleanNum}%");

                    if (! empty($cleanNum) && is_numeric($cleanNum)) {
                        $q->orWhere('wc_order_id', (int) $cleanNum);
                    }

                    $q->orWhere('customer_phone', 'like', "%{$rawSearch}%");
                    if (! empty($cleanDigits)) {
                        $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                        $q->orWhere('customer_phone', 'like', "%{$cleanDigits}%")
                            ->orWhere('customer_phone', 'like', "%{$lastDigits}%");
                    }

                    $q->orWhere('customer_address', 'like', "%{$rawSearch}%")
                        ->orWhere('customer_email', 'like', "%{$rawSearch}%")
                        ->orWhere('size', 'like', "%{$rawSearch}%")
                        ->orWhere('color', 'like', "%{$rawSearch}%");

                    $q->orWhereHas('customer', function ($cq) use ($rawSearch, $cleanDigits) {
                        $cq->where('name', 'like', "%{$rawSearch}%")
                            ->orWhere('phone', 'like', "%{$rawSearch}%");
                        if (! empty($cleanDigits)) {
                            $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                            $cq->orWhere('phone', 'like', "%{$cleanDigits}%")
                                ->orWhere('phone', 'like', "%{$lastDigits}%");
                        }
                    });
                });
            }
        }

        if ($request->query('source') === 'website') {
            $query->orderByDesc('wc_order_id')->orderByDesc('created_at');
        } else {
            $query->orderByDesc('created_at')->orderByDesc('id');
        }

        $courierSettings = CourierSetting::where('provider', 'steadfast')->first();
        $contactPhone = ! empty($courierSettings?->contact_phone) ? $courierSettings->contact_phone : '01333-447475';
        $defaultContactName = ! empty($courierSettings?->contact_name) && strtolower($courierSettings->contact_name) !== 'auliro'
            ? $courierSettings->contact_name
            : 'Zavaani';

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $dateSuffix = $request->start_date . '_to_' . $request->end_date;
        } elseif ($request->filled('start_date')) {
            $dateSuffix = 'from_' . $request->start_date;
        } elseif ($request->filled('end_date')) {
            $dateSuffix = 'to_' . $request->end_date;
        } elseif ($request->filled('date')) {
            $dateSuffix = $request->date;
        } else {
            $dateSuffix = 'All_Time_' . Carbon::now('Asia/Dhaka')->format('Y-m-d');
        }
        $filename = "Problem_Free_Orders_{$dateSuffix}.csv";

        if ($request->query('format') === 'json' || $request->input('format') === 'json') {
            $rows = [];
            $query->chunk(250, function ($orders) use (&$rows, $contactPhone, $defaultContactName) {
                foreach ($orders as $order) {
                    $rows[] = $this->buildProblemFreeExportRow($order, $contactPhone, $defaultContactName);
                }
            });

            return response()->json([
                'status' => 'success',
                'total' => count($rows),
                'filename' => "Problem_Free_Orders_{$dateSuffix}.xlsx",
                'data' => $rows,
            ]);
        }

        return response()->streamDownload(function () use ($query, $contactPhone, $defaultContactName) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM for Excel / Google Sheets
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Invoice',
                'Name',
                'Address',
                'Phone',
                'Amount',
                'Note',
                'Contact Name',
                'Contact Phone',
                'Lot',
                'Delivery Type',
            ]);

            $query->chunk(200, function ($orders) use ($handle, $contactPhone, $defaultContactName) {
                foreach ($orders as $order) {
                    $row = $this->buildProblemFreeExportRow($order, $contactPhone, $defaultContactName);
                    fputcsv($handle, $row);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    /**
     * Build one row for Problem-Free orders CSV export.
     */
    public function buildProblemFreeExportRow(Order $order, string $contactPhone, string $defaultContactName): array
    {
        $itemExtraction = $this->extractCleanOrderItems($order);
        $invoice = $itemExtraction['invoice_string'];
        $lot = $itemExtraction['total_lot'];

        $name = $this->resolveCustomerDisplayName($order);
        $address = $this->resolveCustomerAddress($order);
        $phone = trim((string) ($order->customer_phone ?: ($order->customer?->phone ?: '')));
        $amount = number_format((float) ($order->total_amount ?? 0), 2, '.', '');
        $note = trim((string) ($order->notes ?: ''));

        $pageName = $order->conversation?->socialAccount?->name;
        $contactName = ! empty($pageName) ? $pageName : $defaultContactName;

        $deliveryType = 'Home';
        if (! empty($order->shipping_method_title) && (str_contains(strtolower($order->shipping_method_title), 'point') || str_contains(strtolower($order->shipping_method_title), 'hub') || str_contains(strtolower($order->shipping_method_title), 'pickup'))) {
            $deliveryType = 'Point';
        }

        return [
            $invoice,
            $name,
            $address,
            $phone,
            $amount,
            $note,
            $contactName,
            $contactPhone,
            $lot,
            $deliveryType,
        ];
    }

    /**
     * Extract and format order items with product variation and quantity.
     * Quantity > 1 is appended. Multiple items are chained with " | ".
     */
    public function extractCleanOrderItems(Order $order): array
    {
        $rawItems = $order->items_data;
        if (empty($rawItems) && is_array($order->wc_raw_data) && ! empty($order->wc_raw_data['line_items'])) {
            $rawItems = $order->wc_raw_data['line_items'];
        }

        $formattedItems = [];
        $totalLot = 0;

        if (! empty($rawItems) && is_array($rawItems)) {
            foreach ($rawItems as $item) {
                $parsed = $this->formatSingleExportItem($item, $order);
                $formattedItems[] = $parsed['item_string'];
                $totalLot += $parsed['quantity'];
            }
        } else {
            $fallbackItem = [
                'name' => $order->product?->name ?: 'Product',
                'size' => $order->size,
                'color' => $order->color,
                'quantity' => $order->quantity ?: 1,
            ];
            $parsed = $this->formatSingleExportItem($fallbackItem, $order);
            $formattedItems[] = $parsed['item_string'];
            $totalLot = $parsed['quantity'];
        }

        return [
            'invoice_string' => implode(' | ', $formattedItems),
            'total_lot' => max(1, $totalLot),
        ];
    }

    /**
     * Format a single line item for export: Product Name | Product Variation | Quantity (if > 1).
     */
    public function formatSingleExportItem(array $item, ?Order $order = null): array
    {
        $rawName = trim((string) ($item['name'] ?? $item['product_name'] ?? ''));
        if (empty($rawName) && $order && $order->product) {
            $rawName = $order->product->name;
        }
        if (empty($rawName)) {
            $rawName = 'Product';
        }

        $size = null;
        $color = null;
        $otherVars = [];

        if (! empty($item['meta_data']) && is_array($item['meta_data'])) {
            foreach ($item['meta_data'] as $meta) {
                $key = strtolower($meta['key'] ?? $meta['display_key'] ?? '');
                $dispKey = trim((string) ($meta['display_key'] ?? ''));
                $val = trim((string) ($meta['value'] ?? $meta['display_value'] ?? ''));
                $dispVal = trim((string) ($meta['display_value'] ?? $meta['value'] ?? ''));
                if (empty($val) || is_array($meta['value'] ?? null)) {
                    continue;
                }

                if (str_contains($key, 'size') || str_contains($key, 'সাইজ')) {
                    $size = ! empty($dispVal) ? $dispVal : $val;
                } elseif (str_contains($key, 'color') || str_contains($key, 'colour') || str_contains($key, 'কালার')) {
                    $color = ! empty($dispVal) ? $dispVal : $val;
                } elseif (! empty($dispKey) && ! str_starts_with($meta['key'] ?? '', '_')) {
                    $otherVars[] = "{$dispKey}: {$dispVal}";
                }
            }
        }

        if (! $size && ! empty($item['size'])) {
            $size = trim($item['size']);
        }
        if (! $color && ! empty($item['color'])) {
            $color = trim($item['color']);
        }

        if ((! $size || ! $color) && ! empty($item['variation'])) {
            $vStr = (string) $item['variation'];
            if (! $size && preg_match('/size:\s*([^,;]+)/i', $vStr, $sm)) {
                $size = trim($sm[1]);
            }
            if (! $color && preg_match('/colou?r:\s*([^,;]+)/i', $vStr, $cm)) {
                $color = trim($cm[1]);
            }
        }

        if (! $size && $order && ! empty($order->size)) {
            $size = trim($order->size);
        }
        if (! $color && $order && ! empty($order->color)) {
            $color = trim($order->color);
        }
        if (! $size && ! $color && $order && $order->variant) {
            if ($order->variant->size) $size = $order->variant->size;
            if ($order->variant->color) $color = $order->variant->color;
        }

        if ($size) {
            $size = preg_replace_callback('/\b(year|month|yrs|yr)\b/i', function ($m) {
                return strtoupper($m[1]);
            }, $size);
            $size = preg_replace('/-(\b[A-Z]+\b)/', ' $1', $size);
            $size = trim($size);
        }

        if ($color) {
            $color = ucwords(str_replace(['-', '_'], ' ', $color));
        }

        $cleanName = $rawName;
        if (str_contains($rawName, ' - ')) {
            $lastDashPos = strrpos($rawName, ' - ');
            $baseName = trim(substr($rawName, 0, $lastDashPos));
            $suffix = trim(substr($rawName, $lastDashPos + 3));

            if ($size || $color || preg_match('/\b(YEAR|MONTH|\d+|Maroon|Blue|Black|Red|White|Pink|Green|Yellow|Orange|Brown)\b/i', $suffix)) {
                $cleanName = $baseName;
            }
        }

        $varParts = [];
        if (! empty($size)) {
            $varParts[] = "Size: {$size}";
        }
        if (! empty($color)) {
            $varParts[] = "Color: {$color}";
        }
        foreach ($otherVars as $ov) {
            $varParts[] = $ov;
        }

        $varParts = array_values(array_unique($varParts));
        $varText = implode(', ', $varParts);

        $qty = (int) ($item['quantity'] ?? $item['qty'] ?? 1);
        if ($qty < 1) {
            $qty = 1;
        }

        $tokens = [$cleanName];
        if (! empty($varText)) {
            $tokens[] = $varText;
        }
        if ($qty > 1) {
            $tokens[] = (string) $qty;
        }

        return [
            'item_string' => implode(' | ', $tokens),
            'quantity' => $qty,
        ];
    }

    /**
     * Resolve customer display name for order.
     */
    public function resolveCustomerDisplayName(Order $order): string
    {
        $cName = trim((string) ($order->customer_name ?: ''));
        if (! empty($cName) && ! in_array(strtolower($cName), ['customer', 'guest customer', 'website customer'])) {
            return $cName;
        }

        $cRelName = trim((string) ($order->customer?->name ?: ''));
        if (! empty($cRelName) && ! in_array(strtolower($cRelName), ['customer', 'guest customer', 'website customer'])) {
            return $cRelName;
        }

        if (is_array($order->wc_raw_data)) {
            $bFirst = trim((string) ($order->wc_raw_data['billing']['first_name'] ?? $order->wc_raw_data['shipping']['first_name'] ?? ''));
            $bLast = trim((string) ($order->wc_raw_data['billing']['last_name'] ?? $order->wc_raw_data['shipping']['last_name'] ?? ''));
            $bFull = trim("{$bFirst} {$bLast}");
            if (! empty($bFull) && ! in_array(strtolower($bFull), ['customer', 'guest customer', 'website customer'])) {
                return $bFull;
            }
        }

        return ! empty($cName) ? $cName : (! empty($cRelName) ? $cRelName : 'Customer');
    }

    /**
     * Resolve customer address.
     */
    public function resolveCustomerAddress(Order $order): string
    {
        $addr = trim((string) ($order->customer_address ?: ''));
        if (! empty($addr)) {
            return $addr;
        }

        if (is_array($order->wc_raw_data)) {
            $bAddr1 = trim((string) ($order->wc_raw_data['billing']['address_1'] ?? $order->wc_raw_data['shipping']['address_1'] ?? ''));
            $bAddr2 = trim((string) ($order->wc_raw_data['billing']['address_2'] ?? $order->wc_raw_data['shipping']['address_2'] ?? ''));
            $bCity = trim((string) ($order->wc_raw_data['billing']['city'] ?? $order->wc_raw_data['shipping']['city'] ?? ''));
            $parts = array_filter([$bAddr1, $bAddr2, $bCity]);
            if (! empty($parts)) {
                return implode(', ', $parts);
            }
        }

        return '';
    }

    /**
     * Create an order from conversation or directly.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'customer_name' => 'nullable|string|max:255',
            'customer_email' => 'nullable|string|email|max:255',
            'conversation_id' => 'nullable|exists:conversations,id',
            'product_id' => 'nullable|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'size' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'order_attributes' => 'nullable|array',
            'quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'delivery_charge' => 'required|numeric|min:0',
            'customer_address' => 'required|string',
            'customer_phone' => 'required|string',
            'notes' => 'nullable|string',
            'order_number' => 'nullable|string|max:50',
            'items_data' => 'nullable|array',
        ]);

        if (empty($validated['product_id']) && (empty($validated['items_data']) || ! is_array($validated['items_data']))) {
            return response()->json([
                'status' => 'error',
                'message' => 'কমপক্ষে একটি প্রোডাক্ট সিলেক্ট করা আবশ্যক।',
            ], 422);
        }

        $user = $request->user();

        // Process items_data if provided for multi-item orders
        $cleanedItems = [];
        $totalQty = 0;
        $itemsTotal = 0;

        if (! empty($validated['items_data']) && is_array($validated['items_data'])) {
            foreach ($validated['items_data'] as $it) {
                $pId = ! empty($it['product_id']) ? (int) $it['product_id'] : null;
                $prod = $pId ? Product::find($pId) : null;
                $pName = ! empty($it['name']) ? $it['name'] : ($prod?->name ?? 'Product');
                $q = max(1, (int) ($it['quantity'] ?? 1));
                $p = isset($it['price']) ? (float) $it['price'] : (float) ($prod?->selling_price ?? $prod?->regular_price ?? 0);
                $sz = ! empty($it['size']) ? trim($it['size']) : null;
                $col = ! empty($it['color']) ? trim($it['color']) : null;
                $varId = ! empty($it['variant_id']) ? (int) $it['variant_id'] : null;

                $totalQty += $q;
                $itemsTotal += ($q * $p);

                $cleanedItems[] = [
                    'product_id' => $pId,
                    'variant_id' => $varId,
                    'name' => $pName,
                    'sku' => $it['sku'] ?? $prod?->sku ?? null,
                    'size' => $sz,
                    'color' => $col,
                    'quantity' => $q,
                    'price' => $p,
                    'subtotal' => $q * $p,
                ];
            }
        }

        if (! empty($cleanedItems)) {
            $firstItem = $cleanedItems[0];
            $productId = $firstItem['product_id'] ?? ($validated['product_id'] ?? null);
            $variantId = $firstItem['variant_id'] ?? ($validated['variant_id'] ?? null);
            $size = $firstItem['size'] ?? ($validated['size'] ?? null);
            $color = $firstItem['color'] ?? ($validated['color'] ?? null);
            $quantity = $totalQty;
            $unitPrice = $firstItem['price'];
            $total = $itemsTotal + (float) $validated['delivery_charge'];
            $itemsData = $cleanedItems;
        } else {
            $productId = $validated['product_id'];
            $variantId = $validated['variant_id'] ?? null;
            $size = $validated['size'] ?? null;
            $color = $validated['color'] ?? null;
            $quantity = (int) ($validated['quantity'] ?? 1);
            $unitPrice = (float) ($validated['unit_price'] ?? 0);
            $total = ($unitPrice * $quantity) + (float) $validated['delivery_charge'];

            $prod = $productId ? Product::find($productId) : null;
            $itemsData = [
                [
                    'product_id' => $productId,
                    'variant_id' => $variantId,
                    'name' => $prod?->name ?? 'Product',
                    'sku' => $prod?->sku ?? null,
                    'size' => $size,
                    'color' => $color,
                    'quantity' => $quantity,
                    'price' => $unitPrice,
                    'subtotal' => $quantity * $unitPrice,
                ],
            ];
        }

        // Determine or create customer
        $customerId = $validated['customer_id'] ?? null;
        $customerEmail = ! empty($validated['customer_email']) ? trim($validated['customer_email']) : null;

        if (! $customerId) {
            $customer = Customer::firstOrCreate(
                ['phone' => $validated['customer_phone']],
                [
                    'name' => $validated['customer_name'] ?? 'Customer',
                    'email' => $customerEmail,
                ]
            );
            $customerId = $customer->id;
            if ($customerEmail && empty($customer->email)) {
                $customer->update(['email' => $customerEmail]);
            }
        } else {
            // Update customer phone / email if provided
            $custUpdates = ['phone' => $validated['customer_phone']];
            if ($customerEmail) {
                $custUpdates['email'] = $customerEmail;
            }
            Customer::where('id', $customerId)->update($custUpdates);
            if (! empty($validated['customer_name'])) {
                Customer::where('id', $customerId)
                    ->where(function ($q) {
                        $q->where('name', 'like', 'Facebook%')
                            ->orWhere('name', 'like', 'Customer%')
                            ->orWhereNull('name');
                    })
                    ->update([
                        'name' => $validated['customer_name'],
                    ]);
                \App\Models\CustomerChannelIdentity::where('customer_id', $customerId)
                    ->where(function ($q) {
                        $q->where('profile_name', 'like', 'Facebook%')
                            ->orWhere('profile_name', 'like', 'Customer%')
                            ->orWhereNull('profile_name');
                    })
                    ->update([
                        'profile_name' => $validated['customer_name'],
                    ]);
            }
        }

        // Fallback size & color from variant if not explicitly set
        if (! empty($variantId)) {
            $variant = \App\Models\ProductVariant::find($variantId);
            if ($variant) {
                $size = $size ?: $variant->size;
                $color = $color ?: $variant->color;
            }
        }

        // Custom order number or generate auto ID
        $orderNumber = ! empty($validated['order_number'])
            ? trim($validated['order_number'])
            : 'NF-' . date('ymd') . '-' . rand(1000, 9999);

        // Ensure order number uniqueness
        if (Order::where('order_number', $orderNumber)->exists()) {
            $orderNumber .= '-' . strtoupper(Str::random(3));
        }

        $orderData = [
            'order_number' => $orderNumber,
            'customer_id' => $customerId,
            'conversation_id' => $validated['conversation_id'] ?? null,
            'user_id' => $user->id,
            'product_id' => $productId,
            'variant_id' => $variantId,
            'size' => $size,
            'color' => $color,
            'order_attributes' => $validated['order_attributes'] ?? null,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'delivery_charge' => $validated['delivery_charge'],
            'total_amount' => $total,
            'items_data' => $itemsData,
            'order_status' => 'confirmed',
            'payment_status' => 'unpaid',
            'order_source' => ! empty($validated['conversation_id']) ? 'manual_inbox' : 'web',
            'customer_address' => $validated['customer_address'],
            'customer_phone' => $validated['customer_phone'],
            'customer_email' => $customerEmail,
            'notes' => $validated['notes'] ?? null,
        ];

        $order = DB::transaction(function () use ($orderData, $user, $customerId) {
            $ord = Order::create($orderData);

            // Transition lead to converted if lead exists
            $lead = Lead::where('customer_id', $customerId)->first();
            if ($lead && $lead->status !== 'converted') {
                $prev = $lead->status;
                $lead->update([
                    'status' => 'converted',
                    'last_status_change_at' => now(),
                ]);

                LeadStatusHistory::create([
                    'lead_id' => $lead->id,
                    'previous_status' => $prev,
                    'new_status' => 'converted',
                    'changed_by_user_id' => $user->id,
                    'source' => 'system',
                    'reason' => 'Verified order created: ' . $ord->order_number,
                ]);
            }

            return $ord;
        });

        // Trigger Auto-SMS to Customer via BulkSMS BD if enabled
        $smsResult = app(BulkSmsService::class)->sendAutoOrderSms($order);

        // Post internal note in conversation thread if linked
        if ($order->conversation_id) {
            try {
                $itemDescriptions = [];
                if (! empty($order->items_data) && is_array($order->items_data)) {
                    foreach ($order->items_data as $it) {
                        $vInfo = [];
                        if (! empty($it['size'])) $vInfo[] = "Size: {$it['size']}";
                        if (! empty($it['color'])) $vInfo[] = "Color: {$it['color']}";
                        $vStr = ! empty($vInfo) ? ' (' . implode(', ', $vInfo) . ')' : '';
                        $itemDescriptions[] = ($it['name'] ?? 'Product') . "{$vStr} x" . ($it['quantity'] ?? 1);
                    }
                }
                $productsSummary = ! empty($itemDescriptions) ? implode(' + ', $itemDescriptions) : ($order->product?->name ?: 'Product');

                Message::create([
                    'conversation_id' => $order->conversation_id,
                    'sender_type' => 'moderator',
                    'sender_user_id' => $user->id,
                    'is_internal_note' => true,
                    'text' => "🛍️ Order #{$order->order_number} confirmed! Product(s): {$productsSummary}, Total: ৳{$order->total_amount}. Phone: {$order->customer_phone}",
                    'metadata' => [
                        'order_id' => $order->id,
                        'order_number' => $order->order_number,
                        'auto_sms' => $smsResult,
                    ],
                ]);
            } catch (\Exception $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Order #{$order->order_number} created successfully!",
            'data' => $order->load(['customer', 'product', 'variant']),
            'auto_sms' => $smsResult,
        ], 201);
    }

    /**
     * Update order status.
     */
    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'order_status' => 'required|in:draft,pending_confirmation,confirmed,processing,shipped,delivered,cancelled,returned',
            'payment_status' => 'nullable|in:unpaid,paid,refunded',
        ]);

        $user = $request->user();
        $userName = $user ? $user->name : 'Staff';
        $timeStr = now()->format('d M Y, h:i A');

        if ($validated['order_status'] === 'cancelled' && $order->order_status !== 'cancelled') {
            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_cancelled_at'] = now()->toISOString();
            $raw['cx_cancelled_by'] = $userName;
            $raw['cx_resolved_by'] = $userName;
            $raw['cx_resolution_action'] = 'cancelled';
            $validated['wc_raw_data'] = $raw;

            $cxNote = "[CX Cancelled (by {$userName} on {$timeStr})]";
            $validated['notes'] = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $this->resolveRetainedSiblingsAfterRemoval([$order], 'cancelled', $userName);
        }

        $order->update($validated);

        // If order came from WooCommerce, sync status back to store
        if ($order->wc_order_id && ! empty($validated['order_status'])) {
            try {
                app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                    (int) $order->wc_order_id,
                    $validated['order_status']
                );
            } catch (\Throwable $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Order status updated successfully',
            'data' => $order,
        ]);
    }

    /**
     * Bulk update order status.
     */
    public function bulkUpdateStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'order_status' => 'required|in:draft,pending_confirmation,confirmed,processing,shipped,delivered,cancelled,returned',
        ]);

        $orders = Order::whereIn('id', $validated['order_ids'])->get();
        $newStatus = $validated['order_status'];
        $updatedCount = 0;
        $wcService = app(\App\Services\WooCommerceService::class);
        $user = $request->user();
        $userName = $user ? $user->name : 'Staff';
        $timeStr = now()->format('d M Y, h:i A');

        if ($newStatus === 'cancelled') {
            foreach ($orders as $order) {
                $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
                $raw['is_cx_resolved'] = true;
                $raw['cx_cancelled_at'] = now()->toISOString();
                $raw['cx_cancelled_by'] = $userName;
                $raw['cx_resolved_by'] = $userName;
                $raw['cx_resolution_action'] = 'cancelled';

                $cxNote = "[CX Cancelled (by {$userName} on {$timeStr})]";
                $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

                $order->update([
                    'order_status' => $newStatus,
                    'wc_raw_data' => $raw,
                    'notes' => $updatedNotes,
                ]);
                $updatedCount++;

                if ($order->wc_order_id) {
                    try {
                        $wcService->updateOrderStatusInWooCommerce((int) $order->wc_order_id, $newStatus);
                    } catch (\Throwable $e) {}
                }
            }

            $this->resolveRetainedSiblingsAfterRemoval($orders->all(), 'cancelled', $userName);
        } else {
            foreach ($orders as $order) {
                $order->update(['order_status' => $newStatus]);
                $updatedCount++;

                if ($order->wc_order_id) {
                    try {
                        $wcService->updateOrderStatusInWooCommerce((int) $order->wc_order_id, $newStatus);
                    } catch (\Throwable $e) {
                        // Silently continue
                    }
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "{$updatedCount} orders updated to {$newStatus} successfully.",
            'updated_count' => $updatedCount,
        ]);
    }

    /**
     * Bulk delete orders.
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
        ]);

        $orders = Order::whereIn('id', $validated['order_ids'])->get();
        $user = $request->user();
        $userName = $user ? $user->name : 'Staff';

        // Auto-resolve any retained sibling duplicate orders before deletion
        $this->resolveRetainedSiblingsAfterRemoval($orders->all(), 'deleted', $userName);

        $deletedCount = Order::whereIn('id', $validated['order_ids'])->delete();

        return response()->json([
            'status' => 'success',
            'message' => "{$deletedCount} orders deleted successfully.",
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Delete a single order.
     */
    public function destroy(Order $order): JsonResponse
    {
        $user = auth()->user();
        $userName = $user ? $user->name : 'Staff';

        // Auto-resolve any retained sibling duplicate orders before deletion
        $this->resolveRetainedSiblingsAfterRemoval([$order], 'deleted', $userName);

        $order->delete();

        return response()->json([
            'status' => 'success',
            'message' => "Order #{$order->order_number} deleted successfully.",
        ]);
    }

    /**
     * Automatically mark remaining sibling duplicate order as resolved when duplicates are removed / cancelled.
     */
    protected function resolveRetainedSiblingsAfterRemoval(array $removedOrders, string $actionType, ?string $userName = null): void
    {
        $userName = $userName ?: (auth()->user()?->name ?: 'Staff');
        $timeStr = now()->format('d M Y, h:i A');
        $startDate = Carbon::now()->subDays(15)->startOfDay();

        $normalizePhone = function (?string $phone): string {
            if (empty($phone)) return '';
            $digits = preg_replace('/[^0-9]/', '', $phone);
            if (str_starts_with($digits, '880') && strlen($digits) === 13) {
                $digits = substr($digits, 2);
            }
            if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
                $digits = '0' . $digits;
            }
            return $digits;
        };

        $removedIds = array_filter(array_map(fn($o) => $o->id ?? null, $removedOrders));

        foreach ($removedOrders as $removedOrder) {
            $norm = $normalizePhone($removedOrder->customer_phone ?: $removedOrder->customer?->phone);
            $custId = $removedOrder->customer_id;
            $orderNum = $removedOrder->order_number;

            if (empty($norm) && empty($custId)) continue;

            $siblingsQuery = Order::query()
                ->whereNotIn('id', $removedIds)
                ->where('created_at', '>=', $startDate)
                ->where(function ($q) use ($norm, $custId) {
                    if ($custId) $q->where('customer_id', $custId);
                    if ($norm) {
                        $last10 = strlen($norm) >= 10 ? substr($norm, -10) : $norm;
                        $q->orWhere('customer_phone', 'like', "%{$last10}%");
                    }
                });

            $siblings = $siblingsQuery->get();
            $activeSiblings = $siblings->filter(fn($o) => $o->order_status !== 'cancelled');

            // If exactly 1 active sibling remains, record the audit note but do not mark group resolved
            // so the agent can still review, edit quantity, or confirm the retained order before resolving
            if ($activeSiblings->count() === 1) {
                $retainedOrder = $activeSiblings->first();
                $raw = is_array($retainedOrder->wc_raw_data) ? $retainedOrder->wc_raw_data : [];
                $raw['cx_sibling_cancelled_at'] = now()->toISOString();
                $raw['cx_sibling_cancelled_by'] = $userName;

                $noteMsg = "[CX Verified: Retained order after duplicate #{$orderNum} was {$actionType} by {$userName} on {$timeStr}]";
                $updatedNotes = trim(($retainedOrder->notes ? $retainedOrder->notes . "\n" : '') . $noteMsg);

                $currentItems = is_array($retainedOrder->items_data) && ! empty($retainedOrder->items_data)
                    ? $retainedOrder->items_data
                    : [[
                        'name' => $retainedOrder->product?->name ?: 'Product',
                        'size' => $retainedOrder->size ?: '',
                        'color' => $retainedOrder->color ?: '',
                        'quantity' => (int) ($retainedOrder->quantity ?: 1),
                        'price' => (float) ($retainedOrder->unit_price ?: 0),
                    ]];

                $historyEntry = [
                    'id' => (string) Str::uuid(),
                    'action' => 'duplicate_resolved',
                    'title' => "ডুপ্লিকেট সমাধান (অর্ডার #{$orderNum} {$actionType} করার পর এটি বহাল রাখা হয়েছে)",
                    'performed_by' => $userName,
                    'performed_at' => now()->toISOString(),
                    'formatted_time' => $timeStr,
                    'before' => [
                        'order_status' => $retainedOrder->order_status,
                        'items' => $currentItems,
                        'quantity' => (int) $retainedOrder->quantity,
                        'total_amount' => (float) $retainedOrder->total_amount,
                    ],
                    'after' => [
                        'order_status' => $retainedOrder->order_status === 'pending_confirmation' ? 'confirmed' : $retainedOrder->order_status,
                        'items' => $currentItems,
                        'quantity' => (int) $retainedOrder->quantity,
                        'total_amount' => (float) $retainedOrder->total_amount,
                    ],
                    'note' => $noteMsg,
                ];

                $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
                $history[] = $historyEntry;
                $raw['cx_history'] = $history;
                $raw['cx_last_change'] = $historyEntry;

                $updateData = [
                    'notes' => $updatedNotes,
                    'wc_raw_data' => $raw,
                ];
                if ($retainedOrder->order_status === 'pending_confirmation') {
                    $updateData['order_status'] = 'confirmed';
                }

                $retainedOrder->update($updateData);

                if ($retainedOrder->wc_order_id) {
                    try {
                        app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                            (int) $retainedOrder->wc_order_id,
                            $updateData['order_status'] ?? $retainedOrder->order_status,
                            $noteMsg
                        );
                    } catch (\Throwable $e) {}
                }
            }
        }
    }

    /**
     * Edit / Update an existing order (Customer details, product attributes, size, color, quantity, pricing).
     */
    public function update(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => 'nullable|integer|min:1',
            'size' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'unit_price' => 'nullable|numeric|min:0',
            'delivery_charge' => 'nullable|numeric|min:0',
            'total_amount' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'customer_address' => 'nullable|string',
            'customer_email' => 'nullable|string|email|max:255',
            'order_status' => 'nullable|string|in:draft,pending_confirmation,confirmed,processing,shipped,delivered,cancelled,returned',
            'notes' => 'nullable|string',
            'items_data' => 'nullable|array',
        ]);

        if (isset($validated['items_data']) && is_array($validated['items_data'])) {
            $totalQty = 0;
            $itemsTotal = 0;
            foreach ($validated['items_data'] as $it) {
                $q = (int) ($it['quantity'] ?? 1);
                $p = (float) ($it['price'] ?? 0);
                $totalQty += $q;
                $itemsTotal += ($q * $p);
            }
            if ($totalQty > 0) {
                $validated['quantity'] = $totalQty;
            }
            if (! isset($validated['total_amount']) && $itemsTotal > 0) {
                $delivery = $validated['delivery_charge'] ?? $order->delivery_charge ?? 0;
                $validated['total_amount'] = $itemsTotal + $delivery;
            }

            if (! empty($validated['items_data'][0]['size']) && empty($validated['size'])) {
                $validated['size'] = $validated['items_data'][0]['size'];
            }
            if (! empty($validated['items_data'][0]['color']) && empty($validated['color'])) {
                $validated['color'] = $validated['items_data'][0]['color'];
            }
        }

        $qty = $validated['quantity'] ?? $order->quantity;
        $unitPrice = $validated['unit_price'] ?? $order->unit_price;
        $delivery = $validated['delivery_charge'] ?? $order->delivery_charge;

        if (! isset($validated['total_amount']) && (isset($validated['quantity']) || isset($validated['unit_price']) || isset($validated['delivery_charge']))) {
            $validated['total_amount'] = ($qty * $unitPrice) + $delivery;
        }

        if ($order->customer) {
            $custUpdates = [];
            if (! empty($validated['customer_name'])) $custUpdates['name'] = $validated['customer_name'];
            if (! empty($validated['customer_phone'])) $custUpdates['phone'] = $validated['customer_phone'];
            if (! empty($validated['customer_address'])) $custUpdates['address'] = $validated['customer_address'];
            if (! empty($validated['customer_email'])) $custUpdates['email'] = $validated['customer_email'];
            if (! empty($custUpdates)) {
                $order->customer->update($custUpdates);
            }
        }

        // Capture Before state for CX History & Audit Trail
        $user = $request->user();
        $userName = $user ? $user->name : 'Agent';
        $timeStr = now()->format('d M Y, h:i A');

        $prevItems = is_array($order->items_data) && ! empty($order->items_data)
            ? $order->items_data
            : [[
                'name' => $order->product?->name ?: 'Product',
                'size' => $order->size ?: '',
                'color' => $order->color ?: '',
                'quantity' => (int) ($order->quantity ?: 1),
                'price' => (float) ($order->unit_price ?: 0),
            ]];

        $beforeState = [
            'items' => array_map(function ($it) {
                return [
                    'name' => $it['name'] ?? 'Product',
                    'size' => $it['size'] ?? '',
                    'color' => $it['color'] ?? '',
                    'quantity' => (int) ($it['quantity'] ?? 1),
                    'price' => (float) ($it['price'] ?? 0),
                ];
            }, $prevItems),
            'quantity' => (int) $order->quantity,
            'size' => (string) $order->size,
            'color' => (string) $order->color,
            'unit_price' => (float) $order->unit_price,
            'delivery_charge' => (float) $order->delivery_charge,
            'total_amount' => (float) $order->total_amount,
            'order_status' => (string) $order->order_status,
            'customer_name' => (string) ($order->customer?->name ?: ''),
            'customer_phone' => (string) ($order->customer_phone ?: $order->customer?->phone ?: ''),
            'customer_address' => (string) ($order->customer_address ?: ''),
        ];

        $newItems = isset($validated['items_data']) && is_array($validated['items_data'])
            ? $validated['items_data']
            : $prevItems;

        $targetStatus = $validated['order_status'] ?? ($order->order_status === 'cancelled' ? 'cancelled' : 'confirmed');

        $afterState = [
            'items' => array_map(function ($it) {
                return [
                    'name' => $it['name'] ?? 'Product',
                    'size' => $it['size'] ?? '',
                    'color' => $it['color'] ?? '',
                    'quantity' => (int) ($it['quantity'] ?? 1),
                    'price' => (float) ($it['price'] ?? 0),
                ];
            }, $newItems),
            'quantity' => (int) ($validated['quantity'] ?? $order->quantity),
            'size' => (string) ($validated['size'] ?? $order->size),
            'color' => (string) ($validated['color'] ?? $order->color),
            'unit_price' => (float) ($validated['unit_price'] ?? $order->unit_price),
            'delivery_charge' => (float) ($validated['delivery_charge'] ?? $order->delivery_charge),
            'total_amount' => (float) ($validated['total_amount'] ?? $order->total_amount),
            'order_status' => (string) $targetStatus,
            'customer_name' => (string) ($validated['customer_name'] ?? ($order->customer?->name ?: '')),
            'customer_phone' => (string) ($validated['customer_phone'] ?? $order->customer_phone),
            'customer_address' => (string) ($validated['customer_address'] ?? $order->customer_address),
        ];

        // Record Edit History without prematurely resolving the group/problem
        $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
        $raw['cx_last_edited_at'] = now()->toISOString();
        $raw['cx_last_edited_by'] = $userName;

        $historyEntry = [
            'id' => (string) Str::uuid(),
            'action' => 'edit',
            'title' => 'অর্ডার এডিট ও আপডেট (Order Edited)',
            'performed_by' => $userName,
            'performed_at' => now()->toISOString(),
            'formatted_time' => $timeStr,
            'before' => $beforeState,
            'after' => $afterState,
            'note' => $validated['notes'] ?? null,
        ];

        $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
        $history[] = $historyEntry;
        $raw['cx_history'] = $history;
        $raw['cx_last_change'] = $historyEntry;

        $validated['wc_raw_data'] = $raw;
        $validated['order_status'] = $targetStatus;

        $auditNote = "[CX Edit by {$userName} on " . now()->format('d M H:i') . "]";
        if (! str_contains((string) ($order->notes ?? ''), $auditNote)) {
            $validated['notes'] = trim(($validated['notes'] ?? $order->notes ?? '') . "\n" . $auditNote);
        }

        $order->update($validated);

        $wcSynced = null;
        $wcMessage = null;

        if ($order->wc_order_id) {
            try {
                $wcRes = app(\App\Services\WooCommerceService::class)->updateOrderInWooCommerce(
                    $order,
                    $validated
                );
                $wcSynced = $wcRes['success'] ?? false;
                $wcMessage = $wcRes['message'] ?? null;
                if (! $wcSynced) {
                    \Log::warning("WooCommerce update returned false for #{$order->order_number}: " . ($wcMessage ?? ''));
                }
            } catch (\Throwable $e) {
                \Log::error("Failed to sync order #{$order->order_number} to WooCommerce: " . $e->getMessage());
                $wcSynced = false;
                $wcMessage = $e->getMessage();
            }
        }

        $userMsg = "Order #{$order->order_number} সফলভাবে আপডেট হয়েছে!";
        if ($order->wc_order_id) {
            if ($wcSynced) {
                $userMsg = "✅ Order #{$order->order_number} সফলভাবে আপডেট এবং WooCommerce ওয়েবসাইটে সিঙ্ক করা হয়েছে!";
            } else {
                $userMsg = "⚠️ Order #{$order->order_number} NexFlow-এ আপডেট হয়েছে, তবে ওয়েবসাইটে সিঙ্ক হতে সমস্যা হয়েছে: " . ($wcMessage ?: 'ত্রুটি');
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => $userMsg,
            'wc_synced' => $wcSynced,
            'wc_message' => $wcMessage,
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }

    /**
     * CX Operations: Order Verification Desk for Duplicates & Multi-Quantity Orders.
     */
    public function cxOperations(Request $request): JsonResponse
    {
        $days = $request->integer('days', 10);
        $tab = $request->query('tab', 'all');
        $search = trim((string) $request->query('search', ''));

        $startDate = Carbon::now()->subDays($days)->startOfDay();

        $rawOrders = Order::with(['customer', 'product', 'variant', 'user:id,name'])
            ->where('created_at', '>=', $startDate)
            ->orderByDesc('created_at')
            ->get();

        $normalizePhone = function (?string $phone): string {
            if (empty($phone)) return '';
            $digits = preg_replace('/[^0-9]/', '', $phone);
            if (str_starts_with($digits, '880') && strlen($digits) === 13) {
                $digits = substr($digits, 2);
            }
            if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
                $digits = '0' . $digits;
            }
            return $digits;
        };

        // Helper to resolve genuine customer name from relations, wc_raw_data billing/shipping, etc.
        $resolveCustomerName = function ($ord) {
            if ($ord->customer && ! empty($ord->customer->name)) {
                $cName = trim($ord->customer->name);
                if ($cName !== 'Customer' && $cName !== 'Website Customer' && $cName !== 'Guest Customer') {
                    return $cName;
                }
            }
            $raw = is_array($ord->wc_raw_data) ? $ord->wc_raw_data : [];
            $bFirst = trim($raw['billing']['first_name'] ?? ($raw['shipping']['first_name'] ?? ''));
            $bLast = trim($raw['billing']['last_name'] ?? ($raw['shipping']['last_name'] ?? ''));
            $bFull = trim("{$bFirst} {$bLast}");
            if (! empty($bFull) && $bFull !== 'Customer') {
                return $bFull;
            }
            return $ord->customer?->name ?: ($ord->customer_name ?? 'সম্মানিত গ্রাহক');
        };

        // Helper to extract items with normalized product and size
        $extractOrderItems = function ($order) {
            $rawItems = $order->items_data;
            if (empty($rawItems) && is_array($order->wc_raw_data) && ! empty($order->wc_raw_data['line_items'])) {
                $rawItems = $order->wc_raw_data['line_items'];
            }
            $items = [];
            if (! empty($rawItems) && is_array($rawItems)) {
                foreach ($rawItems as $it) {
                    $pId = $it['product_id'] ?? null;
                    $name = $it['name'] ?? $it['product_name'] ?? $order->product?->name ?? 'Product';
                    $size = trim((string) ($it['size'] ?? ''));
                    $color = trim((string) ($it['color'] ?? ''));
                    $qty = (int) ($it['quantity'] ?? $it['qty'] ?? 1);

                    // check meta_data for size
                    if (empty($size) && ! empty($it['meta_data']) && is_array($it['meta_data'])) {
                        foreach ($it['meta_data'] as $m) {
                            $k = strtolower((string) ($m['key'] ?? $m['display_key'] ?? ''));
                            $v = trim((string) ($m['value'] ?? $m['display_value'] ?? ''));
                            if (str_contains($k, 'size') || str_contains($k, 'সাইজ')) {
                                $size = $v;
                                break;
                            }
                        }
                    }
                    if (empty($size) && count($rawItems) === 1 && ! empty($order->size)) {
                        $size = trim((string) $order->size);
                    }

                    $items[] = [
                        'product_id' => $pId,
                        'name' => $name,
                        'size' => $size,
                        'color' => $color,
                        'quantity' => $qty,
                    ];
                }
            } else {
                $items[] = [
                    'product_id' => $order->product_id,
                    'name' => $order->product?->name ?? 'Product',
                    'size' => trim((string) ($order->size ?? '')),
                    'color' => trim((string) ($order->color ?? '')),
                    'quantity' => (int) ($order->quantity ?? 1),
                ];
            }
            return $items;
        };

        // Attach normalized phone, display customer name, and resolution status to each order
        foreach ($rawOrders as $order) {
            $order->normalized_phone = $normalizePhone($order->customer_phone ?: $order->customer?->phone);
            $order->customer_display_name = $resolveCustomerName($order);
            if ($order->customer && ($order->customer->name === 'Customer' || empty($order->customer->name))) {
                $order->customer->name = $order->customer_display_name;
            }

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $order->is_cx_resolved = ! empty($raw['is_cx_resolved']) 
                || str_contains((string) $order->notes, '[CX Resolved') 
                || str_contains((string) $order->notes, '[CX Review: Quantity adjusted')
                || str_contains((string) $order->notes, '[CX Verified')
                || str_contains((string) $order->notes, '[CX Edit');
        }

        // Group orders by normalized phone + product + size
        // If the customer ordered different products or multiple different sizes, they are NOT duplicates!
        $phoneProductSizeGroups = [];
        foreach ($rawOrders as $ord) {
            $norm = $ord->normalized_phone;
            if (empty($norm)) continue;

            $items = $extractOrderItems($ord);
            $seenKeys = [];

            foreach ($items as $it) {
                $prodKey = $it['product_id'] ? 'pid_' . $it['product_id'] : 'pname_' . Str::slug($it['name']);
                $sizeKey = strtolower(trim((string) $it['size']));
                $groupKey = $norm . '__' . $prodKey . '__' . $sizeKey;

                if (! in_array($groupKey, $seenKeys)) {
                    $seenKeys[] = $groupKey;
                    if (! isset($phoneProductSizeGroups[$groupKey])) {
                        $phoneProductSizeGroups[$groupKey] = [];
                    }
                    $phoneProductSizeGroups[$groupKey][] = $ord;
                }
            }
        }

        $duplicateOrderIds = [];
        $duplicateGroups = [];
        $groupIndex = 1;

        foreach ($phoneProductSizeGroups as $groupKey => $groupList) {
            // If there are 2 or more orders for this customer for the EXACT SAME product AND EXACT SAME size
            if (count($groupList) >= 2) {
                foreach ($groupList as $ord) {
                    $duplicateOrderIds[$ord->id] = true;
                }

                $activeCount = 0;
                $cancelledCount = 0;
                $isGroupResolved = false;
                $resolvedBy = null;
                $resolvedAt = null;

                foreach ($groupList as $ord) {
                    if ($ord->order_status === 'cancelled') {
                        $cancelledCount++;
                    } else {
                        $activeCount++;
                    }

                    $raw = is_array($ord->wc_raw_data) ? $ord->wc_raw_data : [];
                    if (! empty($raw['cx_group_resolved']) || str_contains((string) $ord->notes, '[CX Problem Resolved')) {
                        $isGroupResolved = true;
                        if (! empty($raw['cx_resolved_by']) && empty($resolvedBy)) {
                            $resolvedBy = $raw['cx_resolved_by'];
                            $resolvedAt = $raw['cx_resolved_at'] ?? null;
                        }
                    }
                }

                // If all orders in the group were cancelled, group is resolved
                if ($activeCount === 0 && $cancelledCount >= 2) {
                    $isGroupResolved = true;
                }

                $firstOrder = $groupList[0];
                $duplicateGroups[] = [
                    'group_id' => 'dup_grp_' . $groupIndex++,
                    'group_key' => $groupKey,
                    'customer_name' => $resolveCustomerName($firstOrder),
                    'customer_phone' => $firstOrder->customer_phone ?: $firstOrder->customer?->phone ?: '',
                    'normalized_phone' => $firstOrder->normalized_phone,
                    'customer_address' => $firstOrder->customer_address ?: '',
                    'product_name' => $firstOrder->product?->name ?: ($firstOrder->items_data[0]['name'] ?? 'Product'),
                    'product_image' => $firstOrder->product?->primary_image_url ?: null,
                    'order_count' => count($groupList),
                    'active_order_count' => $activeCount,
                    'cancelled_order_count' => $cancelledCount,
                    'unresolved_order_count' => $isGroupResolved ? 0 : $activeCount,
                    'is_resolved' => $isGroupResolved,
                    'resolved_by' => $resolvedBy,
                    'resolved_at' => $resolvedAt,
                    'orders' => array_values($groupList),
                ];
            }
        }

        // Standalone multi-quantity orders (not part of duplicate groups)
        // ONLY flagged if the customer ordered quantity >= 2 for the EXACT SAME product AND EXACT SAME size.
        // Orders with multiple different sizes or different products are NOT problems and are excluded.
        $standaloneMultiQtyOrders = [];
        foreach ($rawOrders as $order) {
            if (isset($duplicateOrderIds[$order->id])) {
                continue;
            }

            $items = $extractOrderItems($order);
            $hasSameProductSameSizeMultiQty = false;
            $productSizeCounts = [];

            foreach ($items as $it) {
                $pKey = $it['product_id'] ? 'pid_' . $it['product_id'] : 'pname_' . Str::slug($it['name']);
                $sKey = strtolower(trim((string) $it['size']));
                $key = $pKey . '__' . $sKey;

                $qty = (int) ($it['quantity'] ?? 1);
                if ($qty >= 2) {
                    $hasSameProductSameSizeMultiQty = true;
                    break;
                }

                $productSizeCounts[$key] = ($productSizeCounts[$key] ?? 0) + $qty;
                if ($productSizeCounts[$key] >= 2) {
                    $hasSameProductSameSizeMultiQty = true;
                    break;
                }
            }

            if ($hasSameProductSameSizeMultiQty) {
                $order->is_multi_qty = true;
                $standaloneMultiQtyOrders[] = $order;
            }
        }

        // Search matcher
        $matchesSearch = function ($text) use ($search) {
            if (empty($search)) return true;
            return str_contains(strtolower((string) $text), strtolower($search));
        };

        // Filter duplicate groups based on tab and search
        $filteredGroups = [];
        foreach ($duplicateGroups as $grp) {
            if (! empty($search)) {
                $searchMatched = $matchesSearch($grp['customer_name'])
                    || $matchesSearch($grp['customer_phone'])
                    || $matchesSearch($grp['normalized_phone'])
                    || $matchesSearch($grp['product_name']);

                if (! $searchMatched) {
                    foreach ($grp['orders'] as $ord) {
                        if ($matchesSearch($ord->order_number) || $matchesSearch($ord->wc_order_id) || $matchesSearch($ord->customer_address)) {
                            $searchMatched = true;
                            break;
                        }
                    }
                }

                if (! $searchMatched) continue;
            }

            if ($tab === 'duplicates') {
                if (! $grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            } elseif ($tab === 'resolved') {
                if ($grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            } elseif ($tab === 'all') {
                if (! $grp['is_resolved']) {
                    $filteredGroups[] = $grp;
                }
            }
        }

        // Filter standalone multi-quantity orders
        $filteredMultiQty = [];
        foreach ($standaloneMultiQtyOrders as $ord) {
            if (! empty($search)) {
                $searchMatched = $matchesSearch($ord->customer?->name)
                    || $matchesSearch($ord->customer_phone)
                    || $matchesSearch($ord->normalized_phone)
                    || $matchesSearch($ord->order_number)
                    || $matchesSearch($ord->wc_order_id)
                    || $matchesSearch($ord->product?->name);
                if (! $searchMatched) continue;
            }

            if ($tab === 'multi_qty') {
                if (! $ord->is_cx_resolved && $ord->order_status !== 'cancelled') {
                    $filteredMultiQty[] = $ord;
                }
            } elseif ($tab === 'resolved') {
                if ($ord->is_cx_resolved) {
                    $filteredMultiQty[] = $ord;
                }
            } elseif ($tab === 'all') {
                if (! $ord->is_cx_resolved && $ord->order_status !== 'cancelled') {
                    $filteredMultiQty[] = $ord;
                }
            }
        }

        // Cancelled orders - kept for API backward compatibility if explicitly queried
        $cancelledOrders = [];
        if ($tab === 'cancelled') {
            foreach ($rawOrders as $ord) {
                if ($ord->order_status === 'cancelled') {
                    if (! empty($search)) {
                        $searchMatched = $matchesSearch($ord->customer?->name)
                            || $matchesSearch($ord->customer_phone)
                            || $matchesSearch($ord->normalized_phone)
                            || $matchesSearch($ord->order_number)
                            || $matchesSearch($ord->product?->name);
                        if (! $searchMatched) continue;
                    }
                    $cancelledOrders[] = $ord;
                }
            }
        }

        // Additional resolved & cancelled orders (all cancelled orders now reside under resolved tab)
        $otherResolvedOrders = [];
        if ($tab === 'resolved') {
            $existingIds = [];
            foreach ($filteredGroups as $g) {
                foreach ($g['orders'] as $o) {
                    $existingIds[$o->id] = true;
                }
            }
            foreach ($filteredMultiQty as $o) {
                $existingIds[$o->id] = true;
            }

            foreach ($rawOrders as $ord) {
                $isOrdResolved = $ord->is_cx_resolved || $ord->order_status === 'cancelled';
                if ($isOrdResolved && ! isset($existingIds[$ord->id])) {
                    if (! empty($search)) {
                        $searchMatched = $matchesSearch($ord->customer?->name)
                            || $matchesSearch($ord->customer_phone)
                            || $matchesSearch($ord->normalized_phone)
                            || $matchesSearch($ord->order_number)
                            || $matchesSearch($ord->product?->name);
                        if (! $searchMatched) continue;
                    }
                    $otherResolvedOrders[] = $ord;
                }
            }
        }

        $pendingDuplicateGroupsCount = count(array_filter($duplicateGroups, fn($g) => ! $g['is_resolved']));
        $pendingMultiQtyCount = count(array_filter($standaloneMultiQtyOrders, fn($o) => ! $o->is_cx_resolved && $o->order_status !== 'cancelled'));
        $totalReviewNeeded = $pendingDuplicateGroupsCount + $pendingMultiQtyCount;

        $resolvedTotalCount = count(array_filter($rawOrders->toArray(), fn($o) => 
            ! empty($o['wc_raw_data']['is_cx_resolved']) 
            || $o['order_status'] === 'cancelled'
            || str_contains((string) ($o['notes'] ?? ''), '[CX Resolved') 
            || str_contains((string) ($o['notes'] ?? ''), '[CX Review: Quantity adjusted') 
            || str_contains((string) ($o['notes'] ?? ''), '[CX Verified') 
            || str_contains((string) ($o['notes'] ?? ''), '[CX Edit')
            || str_contains((string) ($o['notes'] ?? ''), '[CX Cancelled')
        ));
        $cancelledTotalCount = count(array_filter($rawOrders->toArray(), fn($o) => $o['order_status'] === 'cancelled'));

        return response()->json([
            'status' => 'success',
            'data' => [
                'duplicate_groups' => array_values($filteredGroups),
                'multi_qty_orders' => array_values($filteredMultiQty),
                'cancelled_orders' => array_values($cancelledOrders),
                'other_resolved_orders' => array_values($otherResolvedOrders),
            ],
            'meta' => [
                'total_review_needed' => $totalReviewNeeded,
                'duplicate_groups_count' => $pendingDuplicateGroupsCount,
                'multi_qty_count' => $pendingMultiQtyCount,
                'resolved_count' => $resolvedTotalCount,
                'cancelled_count' => $cancelledTotalCount,
                'days' => $days,
            ],
        ]);
    }

    /**
     * Resolve or Reopen an entire Duplicate Group Problem.
     */
    public function cxResolveGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'reopen' => 'nullable|boolean',
            'note' => 'nullable|string',
        ]);

        $orderIds = $validated['order_ids'];
        $isReopen = ! empty($validated['reopen']);
        $user = $request->user();
        $userName = $user ? $user->name : 'CX Agent';
        $timeStr = now()->format('d M H:i');

        $orders = Order::whereIn('id', $orderIds)->get();

        foreach ($orders as $order) {
            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];

            if ($isReopen) {
                $raw['is_cx_resolved'] = false;
                $raw['cx_group_resolved'] = false;
                $raw['cx_reopened_at'] = now()->toISOString();
                $raw['cx_reopened_by'] = $userName;

                $cxNote = "[CX Problem Reopened by {$userName} on {$timeStr}]";
                $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

                $order->update([
                    'notes' => $updatedNotes,
                    'wc_raw_data' => $raw,
                ]);
            } else {
                $raw['is_cx_resolved'] = true;
                $raw['cx_group_resolved'] = true;
                $raw['cx_resolved_at'] = now()->toISOString();
                $raw['cx_resolved_by'] = $userName;
                $raw['cx_resolution_action'] = 'resolve';

                $cxNote = "[CX Problem Resolved by {$userName} on {$timeStr}]";
                $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

                $currentItems = is_array($order->items_data) && ! empty($order->items_data)
                    ? $order->items_data
                    : [[
                        'name' => $order->product?->name ?: 'Product',
                        'size' => $order->size ?: '',
                        'color' => $order->color ?: '',
                        'quantity' => (int) ($order->quantity ?: 1),
                        'price' => (float) ($order->unit_price ?: 0),
                    ]];

                $historyEntry = [
                    'id' => (string) Str::uuid(),
                    'action' => 'resolve',
                    'title' => 'ডুপ্লিকেট সমস্যা সমাধান করা হয়েছে (Case Resolved)',
                    'performed_by' => $userName,
                    'performed_at' => now()->toISOString(),
                    'formatted_time' => now()->format('d M Y, h:i A'),
                    'before' => [
                        'order_status' => $order->order_status,
                        'items' => $currentItems,
                        'quantity' => (int) $order->quantity,
                        'total_amount' => (float) $order->total_amount,
                    ],
                    'after' => [
                        'order_status' => $order->order_status === 'cancelled' ? 'cancelled' : 'confirmed',
                        'items' => $currentItems,
                        'quantity' => (int) $order->quantity,
                        'total_amount' => (float) $order->total_amount,
                    ],
                    'note' => $cxNote,
                ];

                $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
                $history[] = $historyEntry;
                $raw['cx_history'] = $history;
                $raw['cx_last_change'] = $historyEntry;

                $updateData = [
                    'notes' => $updatedNotes,
                    'wc_raw_data' => $raw,
                ];

                if ($order->order_status !== 'cancelled') {
                    $updateData['order_status'] = 'confirmed';

                    if ($order->wc_order_id) {
                        try {
                            app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                                (int) $order->wc_order_id,
                                'processing'
                            );
                        } catch (\Throwable $e) {}
                    }
                }

                $order->update($updateData);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => $isReopen ? 'সমস্যাটি পুনরায় পেন্ডিং করা হয়েছে।' : 'সম্পূর্ণ ডুপ্লিকেট সমস্যাটি সফলভাবে সমাধান (Resolved) করা হয়েছে!',
        ]);
    }

    /**
     * Perform quick CX action (Resolve, Cancel, Set Qty to 1, or Confirm).
     */
    public function cxAction(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:resolve,confirm,cancel,set_qty_one',
            'reason' => 'nullable|string|max:255',
            'note' => 'nullable|string',
        ]);

        $action = $validated['action'];
        $user = $request->user();
        $userName = $user ? $user->name : 'CX Agent';
        $timeStr = now()->format('d M H:i');

        if ($action === 'resolve') {
            $cxNote = "[CX Resolved & Approved by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['is_cx_resolved'] = true;
            $raw['cx_resolved_at'] = now()->toISOString();
            $raw['cx_resolved_by'] = $userName;
            $raw['cx_resolution_action'] = 'resolve';

            $currentItems = is_array($order->items_data) && ! empty($order->items_data)
                ? $order->items_data
                : [[
                    'name' => $order->product?->name ?: 'Product',
                    'size' => $order->size ?: '',
                    'color' => $order->color ?: '',
                    'quantity' => (int) ($order->quantity ?: 1),
                    'price' => (float) ($order->unit_price ?: 0),
                ]];

            $historyEntry = [
                'id' => (string) Str::uuid(),
                'action' => 'resolve',
                'title' => 'অর্ডার সমাধান ও নিশ্চিত করা হয়েছে (Resolved & Confirmed)',
                'performed_by' => $userName,
                'performed_at' => now()->toISOString(),
                'formatted_time' => now()->format('d M Y, h:i A'),
                'before' => [
                    'order_status' => $order->order_status,
                    'items' => $currentItems,
                    'quantity' => (int) $order->quantity,
                    'total_amount' => (float) $order->total_amount,
                ],
                'after' => [
                    'order_status' => $order->order_status === 'cancelled' ? 'cancelled' : 'confirmed',
                    'items' => $currentItems,
                    'quantity' => (int) $order->quantity,
                    'total_amount' => (float) $order->total_amount,
                ],
                'note' => $cxNote,
            ];

            $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
            $history[] = $historyEntry;
            $raw['cx_history'] = $history;
            $raw['cx_last_change'] = $historyEntry;

            $updateData = [
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ];

            if ($order->order_status !== 'cancelled') {
                $updateData['order_status'] = 'confirmed';
            }

            $order->update($updateData);

            if ($order->wc_order_id && $order->order_status !== 'cancelled') {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderInWooCommerce($order, [
                        'order_status' => 'confirmed',
                        'notes' => $updatedNotes,
                    ]);
                } catch (\Throwable $e) {
                    \Log::error("Failed to sync resolve to WooCommerce for #{$order->order_number}: " . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} marked as Resolved (সমাধান হয়েছে)!",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'set_qty_one') {
            $prevQty = $order->quantity;
            $unitPrice = $order->unit_price ?: ($order->total_amount - $order->delivery_charge) / max(1, $prevQty);
            $newTotal = ($unitPrice * 1) + $order->delivery_charge;

            $cxNote = "[CX Review: Quantity adjusted from {$prevQty} to 1 by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['cx_last_qty_adjusted_at'] = now()->toISOString();
            $raw['cx_last_qty_adjusted_by'] = $userName;
            $raw['cx_resolution_action'] = 'set_qty_one';

            $prevItems = is_array($order->items_data) && ! empty($order->items_data)
                ? $order->items_data
                : [[
                    'name' => $order->product?->name ?: 'Product',
                    'size' => $order->size ?: '',
                    'color' => $order->color ?: '',
                    'quantity' => (int) ($prevQty ?: 1),
                    'price' => (float) ($unitPrice ?: 0),
                ]];

            $itemsPayload = $prevItems;
            if (is_array($itemsPayload) && ! empty($itemsPayload)) {
                $itemsPayload[0]['quantity'] = 1;
                $itemsPayload[0]['subtotal'] = (string) $unitPrice;
                $itemsPayload[0]['total'] = (string) $unitPrice;
            }

            $historyEntry = [
                'id' => (string) Str::uuid(),
                'action' => 'set_qty_one',
                'title' => "কোয়ান্টিটি {$prevQty} থেকে ১ করা হয়েছে (Quantity Adjusted to 1)",
                'performed_by' => $userName,
                'performed_at' => now()->toISOString(),
                'formatted_time' => now()->format('d M Y, h:i A'),
                'before' => [
                    'order_status' => $order->order_status,
                    'items' => $prevItems,
                    'quantity' => (int) $prevQty,
                    'total_amount' => (float) $order->total_amount,
                ],
                'after' => [
                    'order_status' => 'confirmed',
                    'items' => $itemsPayload,
                    'quantity' => 1,
                    'total_amount' => (float) $newTotal,
                ],
                'note' => $cxNote,
            ];

            $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
            $history[] = $historyEntry;
            $raw['cx_history'] = $history;
            $raw['cx_last_change'] = $historyEntry;

            $order->update([
                'quantity' => 1,
                'total_amount' => $newTotal,
                'order_status' => 'confirmed',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
                'items_data' => $itemsPayload,
            ]);

            if ($order->wc_order_id) {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderInWooCommerce($order, [
                        'quantity' => 1,
                        'total_amount' => $newTotal,
                        'order_status' => 'confirmed',
                        'notes' => $updatedNotes,
                        'items_data' => $itemsPayload,
                    ]);
                } catch (\Throwable $e) {
                    \Log::error("Failed to sync qty=1 to WooCommerce for #{$order->order_number}: " . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} quantity adjusted to 1! Total: ৳{$newTotal}",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'confirm') {
            $cxNote = "[CX Verified & Confirmed by {$userName} on {$timeStr}]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['cx_confirmed_at'] = now()->toISOString();
            $raw['cx_confirmed_by'] = $userName;
            $raw['cx_resolution_action'] = 'confirmed';

            $currentItems = is_array($order->items_data) && ! empty($order->items_data)
                ? $order->items_data
                : [[
                    'name' => $order->product?->name ?: 'Product',
                    'size' => $order->size ?: '',
                    'color' => $order->color ?: '',
                    'quantity' => (int) ($order->quantity ?: 1),
                    'price' => (float) ($order->unit_price ?: 0),
                ]];

            $historyEntry = [
                'id' => (string) Str::uuid(),
                'action' => 'confirm',
                'title' => 'অর্ডার কনফার্ম করা হয়েছে (Order Confirmed)',
                'performed_by' => $userName,
                'performed_at' => now()->toISOString(),
                'formatted_time' => now()->format('d M Y, h:i A'),
                'before' => [
                    'order_status' => $order->order_status,
                    'items' => $currentItems,
                    'quantity' => (int) $order->quantity,
                    'total_amount' => (float) $order->total_amount,
                ],
                'after' => [
                    'order_status' => 'confirmed',
                    'items' => $currentItems,
                    'quantity' => (int) $order->quantity,
                    'total_amount' => (float) $order->total_amount,
                ],
                'note' => $cxNote,
            ];

            $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
            $history[] = $historyEntry;
            $raw['cx_history'] = $history;
            $raw['cx_last_change'] = $historyEntry;

            $order->update([
                'order_status' => 'confirmed',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ]);

            if ($order->wc_order_id) {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderInWooCommerce($order, [
                        'order_status' => 'confirmed',
                        'notes' => $updatedNotes,
                    ]);
                } catch (\Throwable $e) {
                    \Log::error("Failed to sync confirm to WooCommerce for #{$order->order_number}: " . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} confirmed successfully!",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        if ($action === 'cancel') {
            $reason = $validated['reason'] ?: 'Duplicate / customer cancelled during verification';
            $cxNote = "[CX Cancelled: {$reason} (by {$userName} on {$timeStr})]";
            $updatedNotes = trim(($order->notes ? $order->notes . "\n" : '') . $cxNote);

            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $raw['cx_cancelled_at'] = now()->toISOString();
            $raw['cx_cancelled_by'] = $userName;
            $raw['cx_resolution_action'] = 'cancelled';

            $currentItems = is_array($order->items_data) && ! empty($order->items_data)
                ? $order->items_data
                : [[
                    'name' => $order->product?->name ?: 'Product',
                    'size' => $order->size ?: '',
                    'color' => $order->color ?: '',
                    'quantity' => (int) ($order->quantity ?: 1),
                    'price' => (float) ($order->unit_price ?: 0),
                ]];

            $historyEntry = [
                'id' => (string) Str::uuid(),
                'action' => 'cancel',
                'title' => 'অর্ডার বাতিল করা হয়েছে (Order Cancelled)',
                'performed_by' => $userName,
                'performed_at' => now()->toISOString(),
                'formatted_time' => now()->format('d M Y, h:i A'),
                'before' => [
                    'order_status' => $order->order_status,
                    'items' => $currentItems,
                    'quantity' => (int) $order->quantity,
                    'total_amount' => (float) $order->total_amount,
                ],
                'after' => [
                    'order_status' => 'cancelled',
                    'reason' => $reason,
                ],
                'note' => $cxNote,
            ];

            $history = is_array($raw['cx_history'] ?? null) ? $raw['cx_history'] : [];
            $history[] = $historyEntry;
            $raw['cx_history'] = $history;
            $raw['cx_last_change'] = $historyEntry;

            $order->update([
                'order_status' => 'cancelled',
                'notes' => $updatedNotes,
                'wc_raw_data' => $raw,
            ]);

            if ($order->wc_order_id) {
                try {
                    app(\App\Services\WooCommerceService::class)->updateOrderInWooCommerce($order, [
                        'order_status' => 'cancelled',
                        'notes' => $updatedNotes,
                    ]);
                } catch (\Throwable $e) {
                    \Log::error("Failed to sync cancel to WooCommerce for #{$order->order_number}: " . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 'success',
                'message' => "Order #{$order->order_number} has been cancelled.",
                'data' => $order->fresh(['customer', 'product', 'variant']),
            ]);
        }

        return response()->json(['status' => 'error', 'message' => 'Invalid action'], 400);
    }

    /**
     * Get Order Summary metrics, KPI counts, and trends by period & source.
     */
    public function summary(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $source = $request->query('source', 'all');

        $startDate = null;
        $endDate = null;

        switch ($period) {
            case 'today':
                $startDate = Carbon::today()->startOfDay();
                $endDate = Carbon::today()->endOfDay();
                break;
            case 'yesterday':
                $startDate = Carbon::yesterday()->startOfDay();
                $endDate = Carbon::yesterday()->endOfDay();
                break;
            case 'this_week':
                $startDate = Carbon::now()->startOfWeek();
                $endDate = Carbon::now()->endOfWeek();
                break;
            case 'last_week':
                $startDate = Carbon::now()->subWeek()->startOfWeek();
                $endDate = Carbon::now()->subWeek()->endOfWeek();
                break;
            case 'this_month':
                $startDate = Carbon::now()->startOfMonth();
                $endDate = Carbon::now()->endOfMonth();
                break;
            case 'last_month':
                $startDate = Carbon::now()->subMonth()->startOfMonth();
                $endDate = Carbon::now()->subMonth()->endOfMonth();
                break;
            case 'custom':
                if ($request->filled('start_date') && $request->filled('end_date')) {
                    $startDate = Carbon::parse($request->start_date)->startOfDay();
                    $endDate = Carbon::parse($request->end_date)->endOfDay();
                }
                break;
            case 'all':
            default:
                // No date constraint
                break;
        }

        $applyFilters = function ($query) use ($startDate, $endDate, $source) {
            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [$startDate, $endDate]);
            }

            if ($source === 'website') {
                $query->whereIn('order_source', ['woocommerce', 'web']);
            } elseif ($source === 'engagement') {
                $query->where(function ($sq) {
                    $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                        ->orWhereNull('order_source')
                        ->orWhere('order_source', '!=', 'woocommerce');
                });
            }
        };

        // KPI Counts
        $baseQuery = Order::query();
        $applyFilters($baseQuery);

        $totalOrders = (clone $baseQuery)->count();

        $deliveredOrders = (clone $baseQuery)->where(function ($q) {
            $q->where('order_status', 'delivered')
                ->orWhere('courier_status', 'delivered');
        })->count();

        $returnedOrders = (clone $baseQuery)->where(function ($q) {
            $q->whereIn('order_status', ['returned', 'cancelled'])
                ->orWhereIn('courier_status', ['cancelled', 'cancelled_approval_pending', 'cancelled_return_received']);
        })->count();

        $processingOrders = (clone $baseQuery)->where(function ($q) {
            $q->whereIn('order_status', ['processing', 'shipped'])
                ->whereNotIn('courier_status', ['delivered', 'cancelled', 'cancelled_return_received']);
        })->count();

        $pendingOrders = (clone $baseQuery)->whereIn('order_status', [
            'draft', 'pending_confirmation', 'confirmed'
        ])->whereNotIn('courier_status', ['delivered', 'cancelled', 'cancelled_return_received'])->count();

        $dispatchedTotal = $deliveredOrders + $returnedOrders;
        $deliveryRate = $dispatchedTotal > 0 ? round(($deliveredOrders / $dispatchedTotal) * 100, 1) : 0;
        $returnRate = $dispatchedTotal > 0 ? round(($returnedOrders / $dispatchedTotal) * 100, 1) : 0;

        // Breakdown by channel in this period
        $websiteCount = (clone $baseQuery)->whereIn('order_source', ['woocommerce', 'web'])->count();
        $engagementCount = $totalOrders - $websiteCount;

        // Daily trend (last 7 or 14 days if month/all, or matching period)
        $trendStart = $startDate ?: Carbon::now()->subDays(6)->startOfDay();
        $trendEnd = $endDate ?: Carbon::now()->endOfDay();

        $dailyStats = Order::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as total'),
            DB::raw("SUM(CASE WHEN order_status = 'delivered' OR courier_status = 'delivered' THEN 1 ELSE 0 END) as delivered"),
            DB::raw("SUM(CASE WHEN order_status IN ('returned', 'cancelled') OR courier_status IN ('cancelled', 'cancelled_return_received') THEN 1 ELSE 0 END) as returned")
        )
            ->whereBetween('created_at', [$trendStart, $trendEnd])
            ->when($source === 'website', fn ($q) => $q->whereIn('order_source', ['woocommerce', 'web']))
            ->when($source === 'engagement', fn ($q) => $q->where(fn ($sq) => $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])->orWhereNull('order_source')->orWhere('order_source', '!=', 'woocommerce')))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date', 'asc')
            ->get();

        // Top Return Reasons breakdown
        $returnReasons = Order::select('return_reason', DB::raw('COUNT(*) as count'))
            ->whereNotNull('return_reason')
            ->where('return_reason', '!=', '')
            ->where(function ($q) {
                $q->whereIn('order_status', ['returned', 'cancelled'])
                    ->orWhereIn('courier_status', ['cancelled', 'cancelled_return_received']);
            })
            ->when($startDate && $endDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
            ->groupBy('return_reason')
            ->orderByDesc('count')
            ->limit(6)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'period' => $period,
                'source' => $source,
                'date_range' => [
                    'start' => $startDate?->toDateString(),
                    'end' => $endDate?->toDateString(),
                ],
                'kpis' => [
                    'total_orders' => $totalOrders,
                    'delivered_orders' => $deliveredOrders,
                    'returned_orders' => $returnedOrders,
                    'processing_orders' => $processingOrders,
                    'pending_orders' => $pendingOrders,
                    'delivery_rate' => $deliveryRate,
                    'return_rate' => $returnRate,
                    'website_count' => $websiteCount,
                    'engagement_count' => $engagementCount,
                ],
                'daily_trends' => $dailyStats,
                'top_return_reasons' => $returnReasons,
            ],
        ]);
    }

    /**
     * Get Returned & Cancelled Orders list with Customer info, Courier status, and Delivery Reasons.
     */
    public function returns(Request $request): JsonResponse
    {
        $period = $request->query('period', 'all');
        $source = $request->query('source', 'all');
        $search = trim($request->query('search', ''));

        $query = Order::with(['customer', 'product', 'variant'])
            ->where(function ($q) {
                $q->whereIn('order_status', ['returned', 'cancelled'])
                    ->orWhereIn('courier_status', ['cancelled', 'cancelled_approval_pending', 'cancelled_return_received', 'hold']);
            });

        // Source Filter
        if ($source === 'website') {
            $query->whereIn('order_source', ['woocommerce', 'web']);
        } elseif ($source === 'engagement') {
            $query->where(function ($sq) {
                $sq->whereIn('order_source', ['manual_inbox', 'import', 'crm'])
                    ->orWhereNull('order_source')
                    ->orWhere('order_source', '!=', 'woocommerce');
            });
        }

        // Period Filter
        if ($period === 'today') {
            $query->whereBetween('created_at', [Carbon::today()->startOfDay(), Carbon::today()->endOfDay()]);
        } elseif ($period === 'yesterday') {
            $query->whereBetween('created_at', [Carbon::yesterday()->startOfDay(), Carbon::yesterday()->endOfDay()]);
        } elseif ($period === 'this_week') {
            $query->whereBetween('created_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        } elseif ($period === 'this_month') {
            $query->whereBetween('created_at', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()]);
        } elseif ($period === 'custom' && $request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                Carbon::parse($request->start_date)->startOfDay(),
                Carbon::parse($request->end_date)->endOfDay(),
            ]);
        }

        // Search Filter
        if (! empty($search)) {
            $cleanDigits = preg_replace('/[^0-9]/', '', $search);
            $cleanNum = ltrim($search, '#');

            $query->where(function ($q) use ($search, $cleanDigits, $cleanNum) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('return_reason', 'like', "%{$search}%")
                    ->orWhere('rider_note', 'like', "%{$search}%")
                    ->orWhere('tracking_code', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));

                if (! empty($cleanDigits)) {
                    $lastDigits = strlen($cleanDigits) >= 10 ? substr($cleanDigits, -10) : $cleanDigits;
                    $q->orWhere('customer_phone', 'like', "%{$cleanDigits}%")
                        ->orWhere('customer_phone', 'like', "%{$lastDigits}%");
                }

                if (! empty($cleanNum) && is_numeric($cleanNum)) {
                    $q->orWhere('wc_order_id', (int) $cleanNum);
                }
            });
        }

        $perPage = $request->integer('per_page', 25);
        $orders = $query->orderByDesc('returned_at')
            ->orderByDesc('updated_at')
            ->paginate($perPage);

        // Compute customer order and return history for each item
        $customerIds = collect($orders->items())->pluck('customer_id')->filter()->unique()->values();

        $customerStats = [];
        if ($customerIds->isNotEmpty()) {
            $stats = Order::select(
                'customer_id',
                DB::raw('COUNT(*) as total_orders'),
                DB::raw("SUM(CASE WHEN order_status IN ('returned', 'cancelled') OR courier_status IN ('cancelled', 'cancelled_return_received') THEN 1 ELSE 0 END) as total_returns")
            )
                ->whereIn('customer_id', $customerIds)
                ->groupBy('customer_id')
                ->get()
                ->keyBy('customer_id');

            foreach ($stats as $cid => $row) {
                $customerStats[$cid] = [
                    'total_orders' => (int) $row->total_orders,
                    'total_returns' => (int) $row->total_returns,
                ];
            }
        }

        // Transform items to attach customer history
        $orders->getCollection()->transform(function ($ord) use ($customerStats) {
            $stats = $customerStats[$ord->customer_id] ?? ['total_orders' => 1, 'total_returns' => 1];
            $ord->customer_total_orders = $stats['total_orders'];
            $ord->customer_total_returns = $stats['total_returns'];
            return $ord;
        });

        return response()->json([
            'status' => 'success',
            'data' => $orders,
        ]);
    }

    /**
     * Update Return Reason / Rider Note for an order.
     */
    public function updateReturnReason(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'return_reason' => 'required|string|max:500',
            'rider_note' => 'nullable|string|max:500',
            'order_status' => 'nullable|in:returned,cancelled,delivered,processing',
        ]);

        $updateData = [
            'return_reason' => $validated['return_reason'],
            'rider_note' => $validated['rider_note'] ?? $order->rider_note,
        ];

        if (! empty($validated['order_status'])) {
            $updateData['order_status'] = $validated['order_status'];
        } else {
            $updateData['order_status'] = 'returned';
        }

        if (in_array($updateData['order_status'], ['returned', 'cancelled']) && ! $order->returned_at) {
            $updateData['returned_at'] = now();
        }

        $order->update($updateData);

        // If WooCommerce order, notify WooCommerce of status change if applicable
        if ($order->wc_order_id && in_array($updateData['order_status'], ['returned', 'cancelled'])) {
            try {
                app(\App\Services\WooCommerceService::class)->updateOrderStatusInWooCommerce(
                    (int) $order->wc_order_id,
                    'cancelled'
                );
            } catch (\Throwable $e) {
                // Silently continue
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Return reason updated successfully!',
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }

    /**
     * Bulk sync live delivery status from Steadfast Courier.
     */
    public function syncCourierStatus(Request $request): JsonResponse
    {
        $service = app(SteadfastCourierService::class);
        $result = $service->syncPendingOrdersStatus(60);

        return response()->json([
            'status' => 'success',
            'message' => "Steadfast Courier sync complete: Checked {$result['total_checked']} orders, updated {$result['updated_count']}.",
            'data' => $result,
        ]);
    }

    /**
     * Check live status of a single order from Steadfast Courier.
     */
    public function checkSingleCourierStatus(Order $order): JsonResponse
    {
        $service = app(SteadfastCourierService::class);
        $result = $service->checkDeliveryStatus($order);

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'data' => $order->fresh(['customer', 'product', 'variant']),
        ]);
    }

    /**
     * Retrieve IDs of all orders within the window that currently have UNRESOLVED duplicate or multi-quantity problems.
     */
    public function getUnresolvedProblemOrderIds(int $days = 15): array
    {
        return Cache::remember('cx_unresolved_problem_order_ids_' . $days, 30, function () use ($days) {
            $startDate = Carbon::now()->subDays($days)->startOfDay();

            $normalizePhone = function (?string $phone): string {
                if (empty($phone)) return '';
                $digits = preg_replace('/[^0-9]/', '', $phone);
                if (str_starts_with($digits, '880') && strlen($digits) === 13) {
                    $digits = substr($digits, 2);
                }
                if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
                    $digits = '0' . $digits;
                }
                return $digits;
            };

            $extractSize = function ($it, $defaultSize) {
                $size = trim((string) ($it['size'] ?? ''));
                if (empty($size) && ! empty($it['meta_data']) && is_array($it['meta_data'])) {
                    foreach ($it['meta_data'] as $m) {
                        $k = strtolower((string) ($m['key'] ?? $m['display_key'] ?? ''));
                        $v = trim((string) ($m['value'] ?? $m['display_value'] ?? ''));
                        if (str_contains($k, 'size') || str_contains($k, 'সাইজ')) {
                            $size = $v;
                            break;
                        }
                    }
                }
                return ! empty($size) ? $size : trim((string) $defaultSize);
            };

            $recentOrders = Order::query()
                ->where('created_at', '>=', $startDate)
                ->get(['id', 'customer_id', 'customer_phone', 'product_id', 'quantity', 'items_data', 'wc_raw_data', 'notes', 'order_status', 'created_at']);

            $groups = [];
            $multiQtyIds = [];
            $resolvedMap = [];

            foreach ($recentOrders as $ord) {
                $raw = is_array($ord->wc_raw_data) ? $ord->wc_raw_data : [];
                $isResolved = ! empty($raw['is_cx_resolved'])
                    || ! empty($raw['cx_group_resolved'])
                    || str_contains((string) $ord->notes, '[CX Resolved')
                    || str_contains((string) $ord->notes, '[CX Problem Resolved')
                    || str_contains((string) $ord->notes, '[CX Review: Quantity adjusted')
                    || str_contains((string) $ord->notes, '[CX Verified')
                    || str_contains((string) $ord->notes, '[CX Edit')
                    || str_contains((string) $ord->notes, '[CX Cancelled')
                    || in_array($ord->order_status, ['confirmed', 'shipped', 'delivered', 'completed']);

                if ($isResolved) {
                    $resolvedMap[$ord->id] = true;
                }

                // Check multi-quantity problem
                $isMulti = false;
                $rawItems = $ord->items_data;
                if (empty($rawItems) && is_array($ord->wc_raw_data) && ! empty($ord->wc_raw_data['line_items'])) {
                    $rawItems = $ord->wc_raw_data['line_items'];
                }

                if (! empty($rawItems) && is_array($rawItems)) {
                    $itemCounts = [];
                    foreach ($rawItems as $it) {
                        $pId = $it['product_id'] ?? null;
                        $name = $it['name'] ?? $it['product_name'] ?? 'product';
                        $size = $extractSize($it, $ord->size ?? '');
                        $pKey = $pId ? 'pid_' . $pId : 'pname_' . Str::slug($name);
                        $key = $pKey . '__' . strtolower($size);

                        $q = (int) ($it['quantity'] ?? $it['qty'] ?? 1);
                        if ($q >= 2) {
                            $isMulti = true;
                            break;
                        }
                        $itemCounts[$key] = ($itemCounts[$key] ?? 0) + $q;
                        if ($itemCounts[$key] >= 2) {
                            $isMulti = true;
                            break;
                        }
                    }
                } else {
                    $isMulti = ((int) ($ord->quantity ?? 1)) >= 2;
                }

                if ($isMulti && ! $isResolved && $ord->order_status !== 'cancelled') {
                    $multiQtyIds[$ord->id] = true;
                }

                // Duplicate grouping (same phone + same product + same size)
                $norm = $normalizePhone($ord->customer_phone);
                if (! empty($norm)) {
                    $seenKeys = [];
                    if (! empty($rawItems) && is_array($rawItems)) {
                        foreach ($rawItems as $it) {
                            $pId = $it['product_id'] ?? null;
                            $name = $it['name'] ?? $it['product_name'] ?? 'product';
                            $size = $extractSize($it, $ord->size ?? '');
                            $pKey = $pId ? 'pid_' . $pId : 'pname_' . Str::slug($name);
                            $k = $norm . '__' . $pKey . '__' . strtolower($size);

                            if (! in_array($k, $seenKeys)) {
                                $seenKeys[] = $k;
                                if (! isset($groups[$k])) {
                                    $groups[$k] = [];
                                }
                                $groups[$k][] = $ord;
                            }
                        }
                    } else {
                        $pKey = $ord->product_id ? 'pid_' . $ord->product_id : 'pname_product';
                        $sKey = strtolower(trim((string) ($ord->size ?? '')));
                        $k = $norm . '__' . $pKey . '__' . $sKey;
                        $groups[$k][] = $ord;
                    }
                }
            }

            $duplicateProblemIds = [];
            foreach ($groups as $group) {
                $activeInGroup = array_filter($group, fn($gOrd) => $gOrd->order_status !== 'cancelled');
                if (count($activeInGroup) <= 1) {
                    continue;
                }

                $anyResolved = false;
                foreach ($activeInGroup as $gOrd) {
                    if (! empty($resolvedMap[$gOrd->id])) {
                        $anyResolved = true;
                        break;
                    }
                }
                if (! $anyResolved) {
                    foreach ($activeInGroup as $gOrd) {
                        $duplicateProblemIds[$gOrd->id] = true;
                    }
                }
            }

            return array_map('intval', array_keys($multiQtyIds + $duplicateProblemIds));
        });
    }

    /**
     * Attach Duplicate / Double Order detection & CX resolution status to orders.
     */
    protected function attachDuplicateStatus($paginatedOrders): void
    {
        $orders = $paginatedOrders->getCollection();
        if ($orders->isEmpty()) {
            return;
        }

        $normalizePhone = function (?string $phone): string {
            if (empty($phone)) return '';
            $digits = preg_replace('/[^0-9]/', '', $phone);
            if (str_starts_with($digits, '880') && strlen($digits) === 13) {
                $digits = substr($digits, 2);
            }
            if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
                $digits = '0' . $digits;
            }
            return $digits;
        };

        // Extract normalized phones and customer IDs from the current page
        $phones = [];
        $customerIds = [];
        foreach ($orders as $order) {
            $norm = $normalizePhone($order->customer_phone ?: $order->customer?->phone);
            if (! empty($norm)) {
                $phones[] = $norm;
            }
            if ($order->customer_id) {
                $customerIds[] = $order->customer_id;
            }
        }

        $phones = array_values(array_unique($phones));
        $customerIds = array_values(array_unique($customerIds));

        // Query related orders within 15 days to detect duplicates
        $duplicateMap = [];
        if (! empty($phones) || ! empty($customerIds)) {
            $startDate = Carbon::now()->subDays(15)->startOfDay();
            $relQuery = Order::query()
                ->where('created_at', '>=', $startDate)
                ->where(function ($q) use ($phones, $customerIds) {
                    if (! empty($customerIds)) {
                        $q->whereIn('customer_id', $customerIds);
                    }
                    if (! empty($phones)) {
                        $q->orWhere(function ($sub) use ($phones) {
                            foreach ($phones as $p) {
                                $last10 = strlen($p) >= 10 ? substr($p, -10) : $p;
                                $sub->orWhere('customer_phone', 'like', "%{$last10}%");
                            }
                        });
                    }
                });

            $relatedOrders = $relQuery->get(['id', 'customer_id', 'customer_phone', 'product_id', 'quantity', 'items_data', 'wc_raw_data', 'notes', 'order_status', 'created_at']);

            $extractSize = function ($it, $defaultSize) {
                $size = trim((string) ($it['size'] ?? ''));
                if (empty($size) && ! empty($it['meta_data']) && is_array($it['meta_data'])) {
                    foreach ($it['meta_data'] as $m) {
                        $k = strtolower((string) ($m['key'] ?? $m['display_key'] ?? ''));
                        $v = trim((string) ($m['value'] ?? $m['display_value'] ?? ''));
                        if (str_contains($k, 'size') || str_contains($k, 'সাইজ')) {
                            $size = $v;
                            break;
                        }
                    }
                }
                return ! empty($size) ? $size : trim((string) $defaultSize);
            };

            $groups = [];
            foreach ($relatedOrders as $ord) {
                $norm = $normalizePhone($ord->customer_phone);
                if (empty($norm)) continue;

                $rawItems = $ord->items_data;
                if (empty($rawItems) && is_array($ord->wc_raw_data) && ! empty($ord->wc_raw_data['line_items'])) {
                    $rawItems = $ord->wc_raw_data['line_items'];
                }

                $seenKeys = [];
                if (! empty($rawItems) && is_array($rawItems)) {
                    foreach ($rawItems as $it) {
                        $pId = $it['product_id'] ?? null;
                        $name = $it['name'] ?? $it['product_name'] ?? 'product';
                        $size = $extractSize($it, $ord->size ?? '');
                        $pKey = $pId ? 'pid_' . $pId : 'pname_' . Str::slug($name);
                        $sKey = strtolower($size);
                        $k = $norm . '__' . $pKey . '__' . $sKey;

                        if (! in_array($k, $seenKeys)) {
                            $seenKeys[] = $k;
                            if (! isset($groups[$k])) {
                                $groups[$k] = [];
                            }
                            $groups[$k][] = $ord;
                        }
                    }
                } else {
                    $pKey = $ord->product_id ? 'pid_' . $ord->product_id : 'pname_product';
                    $sKey = strtolower(trim((string) ($ord->size ?? '')));
                    $k = $norm . '__' . $pKey . '__' . $sKey;
                    $groups[$k][] = $ord;
                }
            }

            $groupResolvedMap = [];
            foreach ($groups as $group) {
                $activeInGroup = array_filter($group, fn($o) => $o->order_status !== 'cancelled');
                $cancelledInGroup = array_filter($group, fn($o) => $o->order_status === 'cancelled');

                $anyResolvedInGroup = false;
                foreach ($group as $gOrd) {
                    $raw = is_array($gOrd->wc_raw_data) ? $gOrd->wc_raw_data : [];
                    if (! empty($raw['cx_group_resolved'])
                        || str_contains((string) $gOrd->notes, '[CX Problem Resolved')) {
                        $anyResolvedInGroup = true;
                        break;
                    }
                }

                // If at most 1 active order remains, or group was explicitly resolved by CX agent:
                $isGroupConflictResolved = count($activeInGroup) <= 1 || $anyResolvedInGroup;

                if ($isGroupConflictResolved) {
                    foreach ($group as $gOrd) {
                        $groupResolvedMap[$gOrd->id] = true;
                    }
                }

                if (count($group) >= 2) {
                    foreach ($group as $gOrd) {
                        $duplicateMap[$gOrd->id] = count($group);
                    }
                }
            }
        }

        // Decorate each order in the collection
        foreach ($orders as $order) {
            $isDuplicate = isset($duplicateMap[$order->id]);
            $isConflictResolved = ! empty($groupResolvedMap[$order->id]);

            // Check multi-quantity: ONLY true if the customer ordered quantity >= 2 of the EXACT SAME product & size
            $isMultiQty = false;
            $rawItems = $order->items_data;
            if (empty($rawItems) && is_array($order->wc_raw_data) && ! empty($order->wc_raw_data['line_items'])) {
                $rawItems = $order->wc_raw_data['line_items'];
            }

            if (! empty($rawItems) && is_array($rawItems)) {
                $itemCounts = [];
                foreach ($rawItems as $it) {
                    $pId = $it['product_id'] ?? null;
                    $name = $it['name'] ?? $it['product_name'] ?? 'product';
                    $size = $extractSize($it, $order->size ?? '');
                    $pKey = $pId ? 'pid_' . $pId : 'pname_' . Str::slug($name);
                    $key = $pKey . '__' . strtolower($size);

                    $q = (int) ($it['quantity'] ?? $it['qty'] ?? 1);
                    if ($q >= 2) {
                        $isMultiQty = true;
                        break;
                    }
                    $itemCounts[$key] = ($itemCounts[$key] ?? 0) + $q;
                    if ($itemCounts[$key] >= 2) {
                        $isMultiQty = true;
                        break;
                    }
                }
            } else {
                $isMultiQty = ((int) ($order->quantity ?? 1)) >= 2;
            }

            // Check if resolved by CX Operation or conflict resolved
            $raw = is_array($order->wc_raw_data) ? $order->wc_raw_data : [];
            $isResolved = ! empty($raw['is_cx_resolved'])
                || $isConflictResolved
                || str_contains((string) $order->notes, '[CX Resolved')
                || str_contains((string) $order->notes, '[CX Problem Resolved')
                || str_contains((string) $order->notes, '[CX Review: Quantity adjusted')
                || str_contains((string) $order->notes, '[CX Verified')
                || str_contains((string) $order->notes, '[CX Edit')
                || str_contains((string) $order->notes, '[CX Cancelled');

            // Determine overall duplicate status
            if ($order->order_status === 'cancelled') {
                $dupStatus = 'cancelled';
            } elseif ($isDuplicate || $isMultiQty) {
                if ($isResolved) {
                    $dupStatus = 'resolved';
                } else {
                    $dupStatus = 'problem_found';
                }
            } else {
                $dupStatus = 'none';
            }

            // Reason label
            $reason = null;
            if ($isDuplicate && $isMultiQty) {
                $reason = 'ডুপ্লিকেট ও একাধিক আইটেম অর্ডার';
            } elseif ($isDuplicate) {
                $reason = 'একই কাস্টমারের ডুপ্লিকেট অর্ডার';
            } elseif ($isMultiQty) {
                $reason = 'একাধিক কোয়ান্টিটি অর্ডার';
            }

            $order->setAttribute('duplicate_status', $dupStatus);
            $order->setAttribute('duplicate_reason', $reason);
            $order->setAttribute('duplicate_count', $duplicateMap[$order->id] ?? ($isMultiQty ? $order->quantity : 1));
            $order->setAttribute('is_duplicate', $isDuplicate);
            $order->setAttribute('is_multi_qty', $isMultiQty);
            $order->setAttribute('is_cx_resolved', $isResolved);
        }
    }
}

