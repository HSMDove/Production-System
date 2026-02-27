import { useLiveTime } from "@/hooks/use-live-time";

interface LiveTimeAgoProps {
  timestamp: string | Date | null;
  className?: string;
}

export function LiveTimeAgo({ timestamp, className }: LiveTimeAgoProps) {
  const timeAgo = useLiveTime(timestamp);

  if (!timestamp || !timeAgo) {
    return null;
  }

  return <span className={className}>{timeAgo}</span>;
}
