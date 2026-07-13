export function ExpiryDateSummary({ date, daysRemaining }: { date: Date; daysRemaining: number }) {
  const label = daysRemaining < 0
    ? `만료 ${Math.abs(daysRemaining)}일 경과`
    : daysRemaining === 0
      ? "오늘 만료"
      : `${daysRemaining}일 남음`;
  const tone = daysRemaining <= 0 ? "expired" : daysRemaining <= 30 ? "urgent" : "attention";
  const formattedDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" }).format(date);

  return <span className="expiry-date-summary">
    <span>만료일</span>
    <time dateTime={date.toISOString()}>{formattedDate}</time>
    <b className={tone}>{label}</b>
  </span>;
}
