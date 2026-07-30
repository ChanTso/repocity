import { add, multiply } from "@core/arithmetic";
import { formatTotal } from "@core/format";

export function cityTotal(blocks: number, floors: number): string {
  return formatTotal(add(multiply(blocks, floors), 1));
}
