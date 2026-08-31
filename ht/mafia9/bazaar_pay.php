<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$CLIENT_ID = 'b1b9d596614ba90c351df5e9ff032bd3d8a0cc63';
$CLIENT_SECRET = '-W5jDhSpc6GuADYIEPhyGAiPYnlPyi0u-qVYMmUQntY';

$input = json_decode(file_get_contents('php://input'), true);
$productId = $input['productId'] ?? '';
$amount = $input['amount'] ?? 0;
$callbackUrl = $input['callbackUrl'] ?? '';

if (!$productId || !$amount) {
    echo json_encode(['success' => false, 'message' => 'اطلاعات ناقص']);
    exit;
}

$ch = curl_init('https://pardakht.cafebazaar.ir/devapi/v2/api/payment/request');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $CLIENT_ID,
    'X-Client-Secret: ' . $CLIENT_SECRET
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'product_id' => $productId,
    'amount' => $amount,
    'redirect_uri' => $callbackUrl
]));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);

if (isset($data['payment_url'])) {
    echo json_encode(['success' => true, 'url' => $data['payment_url']]);
} else {
    echo json_encode(['success' => false, 'message' => 'خطا: ' . ($data['message'] ?? 'نامشخص') . ' (کد: ' . $httpCode . ')']);
}
?>