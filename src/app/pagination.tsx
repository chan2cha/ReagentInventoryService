import Link from "next/link";
export function Pagination({ page, totalPages, total, pathname, paramName="page", preserve={} }: { page: number; totalPages: number; total: number; pathname: string; paramName?:string; preserve?:Record<string,string|undefined> }) {
  const start = total ? (page - 1) * 20 + 1 : 0; const end = Math.min(page * 20, total);
  const href=(next:number)=>{const query=new URLSearchParams(); for(const [key,value] of Object.entries(preserve)) if(value) query.set(key,value); query.set(paramName,String(next)); return `${pathname}?${query}` as never;};
  return <nav className="pagination" aria-label="페이지 이동"><span>전체 {total}건 · {start}-{end}</span><div>{page > 1 ? <Link href={href(page-1)}>이전</Link> : <span className="disabled">이전</span>}<strong>{page} / {totalPages}</strong>{page < totalPages ? <Link href={href(page+1)}>다음</Link> : <span className="disabled">다음</span>}</div></nav>;
}
