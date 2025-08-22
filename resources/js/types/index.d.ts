// --- 1. 基本的な型定義 ---

// Inertia.jsから渡されるプロパティの基本形
export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    auth: {
        user: User;
        permissions?: string[];
        isSuperAdmin?: boolean;
    };
    flash: {
        success?: string;
        error?: string;
    };
    queryParams?: Record<string, string>;
};

// ページネーションのレスポンスの型
export interface PaginatedResponse<T> {
    data: T[];
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    current_page: number;
    first_page_url: string;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    total: number;
}

// --- 2. モデルに対応する型定義 ---

// ユーザー・権限関連
export interface User {
    id: number;
    name: string;
    email: string;
    phone_number: string | null;
    line_name: string | null;
    status: 'active' | 'retired' | 'shared';
    memo: string | null;
    email_verified_at: string | null;
    must_change_password: boolean;
    created_at: string;
    updated_at: string;
    // optional UI fields
    avatar?: string | undefined;
    // relations
    roles?: Role[];
}

export interface Role {
    id: number;
    name: string;
    description: string | null;
    order_column: number;
    // relations
    permissions?: Permission[];
}

export interface Permission {
    id: number;
    name: string;
    description: string | null;
}

// シフト関連
export interface ShiftSetting {
    id: number;
    apply_deadline_days: number;
    default_schedule_view_start_time: string | null;
    default_schedule_view_end_time: string | null;
    schedule_interval_minutes: number;
}

export interface UserShiftSetting {
    id: number;
    user_id: number;
    monthly_leave_limit: number;
}

export interface DefaultShift {
    id: number;
    name: string;
    type: 'weekday' | 'holiday';
    day_of_week: number;
    shift_type: 'day' | 'night';
    start_time: string;
    end_time: string;
}

export interface ShiftApplication {
    id: number;
    user_id: number;
    date: string;
    status: 'pending' | 'approved' | 'rejected';
    reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface Shift {
    id: number;
    user_id: number;
    date: string;
    start_time: string;
    end_time: string;
    created_at: string;
    updated_at: string;
    breaks?: BreakTime[];
}

export interface BreakTime {
    id: number;
    shift_id: number;
    type: 'scheduled' | 'actual';
    start_time: string;
    end_time: string;
    actual_start_time: string | null;
    actual_end_time: string | null;
    created_at: string;
    updated_at: string;
}

// 掲示板・タスク・日報関連
export interface Post {
    id: number;
    user_id: number;
    type: 'board' | 'manual';
    title: string;
    body: string;
    is_public: boolean;
    created_at: string;
    updated_at: string;
    user?: User;
}

export interface PostItem {
    id: number;
    post_id: number;
    order: number;
    content: string | null;
    created_at: string;
    updated_at: string;
}

export interface Comment {
    id: number;
    post_id: number;
    user_id: number;
    body: string;
    created_at: string;
    updated_at: string;
    user?: User;
}

export interface CommentRead {
    comment_id: number;
    user_id: number;
    read_at: string;
}

export interface Reaction {
    id: number;
    reactable_id: number;
    reactable_type: string;
    user_id: number;
    emoji: string;
    created_at: string;
    updated_at: string;
}

export interface PostRead {
    id: number;
    post_id: number;
    user_id: number;
    read_at: string;
}

export interface Tag {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: number;
    user_id: number;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
    assignees?: User[];
}

export interface DailyReport {
    id: number;
    user_id: number;
    title: string;
    date: string;
    body: string;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

// 資産・データ管理関連
export interface InventoryCategory {
    id: number;
    name: string;
    order_column: number;
    created_at: string;
    updated_at: string;
}

export interface Supplier {
    id: number;
    name: string;
    contact_person: string | null;
    phone_number: string | null;
    address: string | null;
    order_column: number;
    created_at: string;
    updated_at: string;
}

export interface InventoryItem {
    id: number;
    name: string;
    category_id: number;
    supplier_id: number | null;
    size: string | null;
    unit: string | null;
    memo: string | null;
    created_at: string;
    updated_at: string;
}

export interface InventoryStock {
    id: number;
    inventory_item_id: number;
    storage_location: string;
    quantity: number;
    memo: string | null;
    last_stocked_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface InventoryStockLog {
    id: number;
    inventory_stock_id: number;
    user_id: number | null;
    change_date: string;
    quantity_before: number;
    quantity_after: number;
    reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface DamageCondition {
    id: number;
    condition: string;
    order_column: number;
}

export interface DamagedInventory {
    id: number;
    inventory_item_id: number;
    handler_user_id: number;
    management_number: string | null;
    damaged_at: string;
    damage_condition_id: number;
    damaged_area: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    compensation_amount: number | null;
    payment_method: string | null;
    receipt_number: string | null;
    receipt_image_path: string | null;
    memo: string | null;
    created_at: string;
    updated_at: string;
}

export interface RealEstateAgent {
    id: number;
    name: string;
    order_column: number;
}

export interface Property {
    id: number;
    name: string;
    real_estate_agent_id: number;
    postal_code: string | null;
    address: string;
    has_parking: boolean;
    layout: string | null;
    contract_date: string;
    cancellation_date: string | null;
    room_details: string | null;
    memo: string | null;
    order_column: number;
    key_returned: boolean;
    created_at: string;
    updated_at: string;
}

export interface RoomOccupancy {
    id: number;
    property_id: number;
    user_id: number;
    move_in_date: string;
    move_out_date: string | null;
    final_move_out_user_id: number | null;
    checkout_user_id: number | null;
    checkout_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface FurnitureMaster {
    id: number;
    name: string;
    order_column: number;
    created_at: string;
    updated_at: string;
}

export interface PropertyFurniture {
    id: number;
    property_id: number;
    furniture_master_id: number;
    quantity: number;
    removal_start_date: string | null;
    removal_date: string | null;
    created_at: string;
    updated_at: string;
}

// その他
export interface Feedback {
    id: number;
    user_id: number | null;
    title: string;
    category: string;
    priority: string;
    body: string;
    created_at: string;
    updated_at: string;
}

export interface Attachment {
    id: number;
    attachable_id: number;
    attachable_type: string;
    file_path: string;
    original_name: string;
    created_at: string;
    updated_at: string;
}

// --- 3. UI / layout helper types ---

// ナビゲーション項目
export interface NavItem {
    title: string;
    href: string;
    // Icon components from lucide-react are renderable in JSX
    icon?: import('react').ComponentType<any>;
    // Optional permission name required to view this nav item
    permission?: string;
}

// パンくずデータ
export interface BreadcrumbItem {
    title: string;
    href?: string;
}

// ページ共有データ（usePage の generic に使用する想定）
export interface SharedData extends PageProps<Record<string, unknown>> {
    sidebarOpen?: boolean;
}
