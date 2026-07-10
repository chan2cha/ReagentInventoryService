import { describe,expect,it } from "vitest";
import { pageMeta,paginateRows,parsePage } from "./pagination";

describe("pagination",()=>{
  it("normalizes invalid pages",()=>{expect(parsePage("0")).toBe(1);expect(parsePage("abc")).toBe(1);});
  it("clamps pages to the available range",()=>{expect(pageMeta(9,45)).toMatchObject({page:3,totalPages:3,skip:40});});
  it("returns twenty rows per page",()=>{const data=paginateRows(Array.from({length:45},(_,i)=>i+1),2);expect(data.rows).toEqual(Array.from({length:20},(_,i)=>i+21));});
});
