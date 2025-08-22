type DayCell = {
    date: string;
    label: string;
    shifts: Array<{ user_name?: string; shift_type?: string }>;
};

export default function CalendarMonth({ year, month, days, holidays = [] }: { year: number; month: number; days: DayCell[]; holidays?: string[] }) {
    // month: 1-12
    const monthLabel = `${year}年${month}月`;

    return (
        <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
                <div className="text-lg font-semibold">{monthLabel}</div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-sm">
                <div className="text-center font-medium">日</div>
                <div className="text-center font-medium">月</div>
                <div className="text-center font-medium">火</div>
                <div className="text-center font-medium">水</div>
                <div className="text-center font-medium">木</div>
                <div className="text-center font-medium">金</div>
                <div className="text-center font-medium">土</div>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
                {days.map((d) => {
                    const dt = new Date(d.date);
                    const isSat = dt.getDay() === 6;
                    const isSun = dt.getDay() === 0;
                    const isHoliday = holidays.includes(d.date);
                    const bgClass = isHoliday || isSun ? 'bg-red-50' : isSat ? 'bg-blue-50' : 'bg-white';

                    return (
                        <div key={d.date} className={`min-h-20 rounded-md border p-2 ${bgClass}`}>
                            <div className="mb-1 text-xs text-muted-foreground">{d.label}</div>
                            <div className="space-y-1">
                                {d.shifts.slice(0, 3).map((s, i) => (
                                    <div key={i} className="truncate text-xs">
                                        {s.user_name ?? '—'} {s.shift_type ? `(${s.shift_type})` : ''}
                                    </div>
                                ))}
                                {d.shifts.length > 3 && <div className="text-xs text-muted-foreground">+{d.shifts.length - 3} more</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
