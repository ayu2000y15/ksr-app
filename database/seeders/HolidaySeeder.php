<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Holiday;

class HolidaySeeder extends Seeder
{
    public function run(): void
    {
        // Sample holidays (adjust for production/localization)
        $list = [
            ['date' => '2025-01-01', 'name' => '元日'],
            ['date' => '2025-02-11', 'name' => '建国記念の日'],
            ['date' => '2025-05-03', 'name' => '憲法記念日'],
        ];

        foreach ($list as $h) {
            Holiday::updateOrCreate(['date' => $h['date']], ['name' => $h['name']]);
        }
    }
}
