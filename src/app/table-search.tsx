import { Search, X } from "lucide-react";
import Link from "next/link";

export function TableSearch({ pathname, value, placeholder, paramName = "q", preserve = {} }: { pathname: string; value?: string; placeholder: string; paramName?: string; preserve?: Record<string, string | undefined> }) {
  const resetQuery = new URLSearchParams();
  for (const [key, item] of Object.entries(preserve)) if (item) resetQuery.set(key, item);
  const resetHref = resetQuery.size ? `${pathname}?${resetQuery}` : pathname;
  return <form action={pathname} className="table-search" method="get">{Object.entries(preserve).map(([key, item]) => item ? <input key={key} name={key} type="hidden" value={item} /> : null)}<Search aria-hidden="true" size={17} /><input defaultValue={value} name={paramName} placeholder={placeholder} /><button type="submit">검색</button>{value ? <Link aria-label="검색 초기화" href={resetHref as never}><X size={16} /></Link> : null}</form>;
}
