<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ここにバックアップのスケジュールを追記します
Schedule::command('backup:run --only-db')->dailyAt('03:00');
Schedule::command('backup:run')->dailyAt('04:00');
Schedule::command('backup:clean')->dailyAt('05:00');
