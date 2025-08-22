<?php

return [
    // 申請期限（日数）。0 または未設定の場合は期限チェックを無効にする。
    // 例: .env に SHIFT_APPLICATION_DEADLINE_DAYS=3 と設定すると、
    // 対象日の3日前までに申請が必要になります。
    'application_deadline_days' => (int) env('SHIFT_APPLICATION_DEADLINE_DAYS', 0),
];
