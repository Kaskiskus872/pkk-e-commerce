<?php

class Order_model {
    private $table = "orders";
    private $db;

    public function __construct()
    {
        $host = DB_HOST;
        $port = DB_PORT;
        $dbname = DB_NAME;
        $user = DB_USER;
        $pass = DB_PASS;

        try {
            $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
            $options = [
                PDO::ATTR_PERSISTENT => true,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ];
            $this->db = new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $e) {
            die("Koneksi database gagal: " . $e->getMessage());
        }
    }

    // ======= ANALYTICS =======
    public function getTotalOrders(): int
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) as total FROM orders");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($result['total'] ?? 0);
    }

    public function getTotalRevenue(): float
    {
        $stmt = $this->db->prepare("SELECT SUM(total) as revenue FROM orders WHERE status = 'completed'");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (float)($result['revenue'] ?? 0);
    }

    public function getMonthlySalesChart($year = null): array
    {
        if (!$year) $year = date('Y');
        $stmt = $this->db->prepare("
            SELECT MONTH(created_at) as month, COUNT(*) as total 
            FROM orders 
            WHERE YEAR(created_at) = :year 
            GROUP BY MONTH(created_at) 
            ORDER BY month ASC
        ");
        $stmt->execute(['year' => $year]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ======= ORDER FLOW =======
    public function createOrderFromCart(string $userId, string $customerAddress): ?string
    {
        try {
            $this->db->beginTransaction();

            $cartItems = $this->getCartWithItems($userId);
            if (empty($cartItems)) {
                throw new Exception("Cart kosong atau tidak ditemukan");
            }

            $this->validateProductAvailability($cartItems);
            $total = $this->calculateOrderTotal($cartItems);

            $orderId = $this->createOrderRecord($userId, $total, $customerAddress);
            $this->createOrderItems($orderId, $cartItems);
            $this->clearCart($cartItems[0]['cart_id']);

            $this->db->commit();
            return $orderId;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Order creation failed: " . $e->getMessage());
            return null;
        }
    }

    private function createOrderRecord(string $userId, float $total, string $customerAddress): string
    {
        $id = uniqid('ord_'); // generate custom ID biar konsisten
        $stmt = $this->db->prepare("
            INSERT INTO orders (id, user_id, total, status, customer_address, created_at)
            VALUES (:id, :user_id, :total, 'pending', :customer_address, NOW())
        ");
        $stmt->execute([
            "id" => $id,
            "user_id" => $userId,
            "total" => $total,
            "customer_address" => $customerAddress
        ]);
        return $id;
    }

    private function createOrderItems(string $orderId, array $cartItems): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO order_items (id, order_id, product_id, quantity, price)
            VALUES (:id, :order_id, :product_id, :quantity, :price)
        ");

        foreach ($cartItems as $item) {
            $stmt->execute([
                "id" => uniqid('oi_'),
                "order_id" => $orderId,
                "product_id" => $item['product_id'],
                "quantity" => $item['quantity'],
                "price" => $item['price']
            ]);
        }
    }

    private function clearCart(string $cartId): void
    {
        $this->db->prepare("DELETE FROM cart_items WHERE cart_id = :cart_id")
            ->execute(["cart_id" => $cartId]);
    }

    // ======= ORDER QUERIES =======
    public function getOrderById(string $userId, string $orderId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT 
                o.id, 
                o.total, 
                o.status, 
                o.customer_address,
                o.created_at,
                o.user_id
            FROM orders o
            WHERE o.id = :order_id AND o.user_id = :user_id
        ");
        $stmt->execute(["order_id" => $orderId, "user_id" => $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function updateOrderStatus(string $orderId, string $status): bool
    {
        $stmt = $this->db->prepare("
            UPDATE orders 
            SET status = :status, updated_at = NOW()
            WHERE id = :order_id
        ");
        return $stmt->execute(["status" => $status, "order_id" => $orderId]);
    }

    public function getOrderHistory(string $userId): array
{
    $stmt = $this->db->prepare("
        SELECT 
            o.id AS order_id,
            o.total,
            o.status,
            o.customer_address,
            o.created_at,
            oi.id AS order_item_id,
            oi.quantity,
            oi.price AS item_price,
            p.id AS product_id,
            p.title AS product_name
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = :user_id
        ORDER BY o.created_at DESC
    ");
    $stmt->bindValue("user_id", $userId);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $orders = [];
    foreach ($rows as $row) {
        $oid = $row['order_id'];

        if (!isset($orders[$oid])) {
            $orders[$oid] = [
                'id' => $row['order_id'],
                'total' => $row['total'],
                'status' => $row['status'],
                'customer_address' => $row['customer_address'],
                'created_at' => $row['created_at'],
                'items' => [],
                'item_count' => 0
            ];
        }

        if ($row['order_item_id']) {
            $orders[$oid]['items'][] = [
                'id' => $row['order_item_id'],
                'product_id' => $row['product_id'],
                'name' => $row['product_name'],
                'quantity' => (int)$row['quantity'],
                'price' => (float)$row['item_price']
            ];
            $orders[$oid]['item_count'] += (int)$row['quantity'];
        }
    }

    return array_values($orders);
}




    public function getOrderItems(string $orderId): array
    {
        $stmt = $this->db->prepare("
            SELECT 
                oi.id, 
                oi.product_id, 
                oi.quantity, 
                oi.price, 
                p.title AS name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = :order_id
        ");
        $stmt->execute(["order_id" => $orderId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ======= HELPERS =======
    private function getCartWithItems(string $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT 
                c.id AS cart_id,
                ci.id AS item_id,
                ci.product_id,
                ci.quantity,
                p.price,
                p.stock
            FROM carts c
            JOIN cart_items ci ON c.id = ci.cart_id
            JOIN products p ON ci.product_id = p.id
            WHERE c.user_id = :user_id AND c.deleted_at IS NULL
        ");
        $stmt->execute(["user_id" => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function validateProductAvailability(array $cartItems): void
    {
        foreach ($cartItems as $item) {
            if ($item['quantity'] > $item['stock']) {
                throw new Exception("Produk " . $item['product_id'] . " stok tidak mencukupi");
            }
        }
    }

    private function calculateOrderTotal(array $cartItems): float
    {
        $total = 0;
        foreach ($cartItems as $item) {
            $total += $item["quantity"] * $item["price"];
        }
        return round($total, 2);
    }
}
