import DailyTimeline from './daily-timeline';

export default function ShiftTimeline(props: {
    date: string;
    shiftDetails?: any[];
    initialInterval?: number;
    onBarClick?: (id: number) => void;
    onCreateBreak?: (p: any) => void;
    breaks?: any[];
    onDateChange?: (daysDelta: number) => void;
    canAddUser?: boolean;
}) {
    const { initialInterval = 30 } = props;
    return <DailyTimeline {...props} mode="shift" initialInterval={initialInterval} />;
}
