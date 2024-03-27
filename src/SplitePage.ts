import { ModuleType, PageInfo } from "../index";
import Const from "./const";
import {
  TbModuleInfoItem,
  CurrentStyleElement,
  Ele,
  TbQueueItem,
} from "../index";
import DfsChild from "./DfsChild";
import * as module from "module";

export default class SplitePage extends DfsChild {
  constructor() {
    super();
  }
  completeSplit = false;
  tBody: HTMLElement[] | null = null;
  cloneEmptyTable: HTMLElement | null = null;

  tbodyAppendChild(table: HTMLElement, row: HTMLElement) {
    table.querySelector("." + Const.elTbody)?.appendChild(row);
  }

  /**
   * 拆分table
   */
  splitTable(ele: Ele, distance: number) {
    const moduleInfo = this.childMap.get(ele);
    const {
      tbTopInfo,
      table,
      tbBomInfo,
      minHeight,
      marginPadHeight,
      needMerge,
      expandRow,
    } = moduleInfo.tableModuleInfo;
    if (distance < minHeight) {
      distance = this.createWraper(ele) - marginPadHeight;
    } else {
      distance = distance - marginPadHeight;
    }

    table?.modules?.forEach((module: any) => {
      let flag = false;
      if (
        module.classList.contains(Const.cardTableTopWraper) &&
        distance > minHeight
      ) {
        flag = true;
      }

      if (
        module.classList.contains(Const.cardTableWraper) &&
        distance > table.height
      ) {
        flag = true;
      }

      if (
        module.classList.contains(Const.cardTableBomWraper) &&
        distance > module.height
      ) {
        flag = true;
      }

      if (flag) {
        distance = this.appendModule(
          module,
          module.height,
          ModuleType.TB_MODULE
        );
      } else {
        if (module.classList.contains(Const.cardTableWraper)) {
          const rowQueue = this.findRows(module);
          const headerDom = rowQueue[0]?.cloneNode(true);
          this.cleanTbody(module);
          this.cloneTable(module as HTMLElement);
          if (distance < minHeight) {
            distance = this.createWraper(module);
          }
          distance = this.appendModule(
            this.createTBModule(this.cloneEmptyTable as Element),
            100,
            ModuleType.TBODY
          );

          while (rowQueue.length > 0) {
            let row = rowQueue.shift();
            const height = (row as any).calcHeight;
            if (distance > height) {
              distance = this.appendModule(
                row as Element,
                height,
                ModuleType.ROW
              );
            } else {
              distance = this.createWraper(module);
              distance = this.appendModule(
                this.createTBModule(this.cloneEmptyTable as Element),
                100,
                ModuleType.TBODY
              );

              if (expandRow && headerDom) {
                const cloneHeader = headerDom.cloneNode(true);
                this.appendModule(cloneHeader as Element, 0, ModuleType.ROW);
              }

              if (needMerge) {
                console.log("needMerge", (row as any).mergedInfo);
                const { needMergeRow, isLeftRow, needRowSpanNum } = (row as any)
                  .mergedInfo;
                if (needMergeRow && isLeftRow && needRowSpanNum) {
                  let td = document.createElement("td");
                  td.classList.add("el-table_1_column_1");
                  td.classList.add("el-table__cell");
                  td.setAttribute("rowspan", String(needRowSpanNum));
                  row && row.prepend(td);
                }
              }
              distance = this.appendModule(
                row as Element,
                height,
                ModuleType.ROW
              );
            }
          }
        } else {
          distance = this.createWraper(ele);
          distance = this.appendModule(
            module,
            module.height,
            ModuleType.TB_MODULE
          );
        }
      }
    });
    return distance;
  }

  /**
   * 拆分页面
   */
  splitPage(pageInfo: PageInfo) {
    this.pageInfo = pageInfo;
    let distance = 0;
    let idx = 0;
    const stack = [...(this.childMap.keys() as any)];
    let flag = true;
    const next = () => {
      if (idx >= stack.length) return;
      const ele = stack[idx++];
      this.currentClassName = ele.classList?.[0]
      if (ele?.classList?.contains(Const.printImg)) {
        this.createWraper(ele);
        this.appendModule(ele, 0, ModuleType.IMG);
        if (!flag) {
          flag = true;
        }
      } else {
        if (flag) {
          distance = this.createWraper(ele);
          flag = false;
        }

        const nodeInfo = this.childMap.get(ele);
        // 剩余距离小于 元素的高度 放不下
        if (distance < nodeInfo.height) {
          // 是table
          if (nodeInfo.isTable) {
            distance = this.splitTable(ele, distance);
          } else {
            // 重新创建页面
            this.createWraper(ele);
            distance = this.appendModule(
              ele,
              nodeInfo.height,
              ModuleType.MODULE
            );
          }
        } else {
          // 能放下
          distance = this.appendModule(ele, nodeInfo.height, ModuleType.MODULE);
        }
      }
      next();
    };
    next();
  }

  cloneTable(table: HTMLElement) {
    this.cloneEmptyTable = table.cloneNode(true) as HTMLElement;
    this.removeStyleHeight();
  }

  removeStyleHeight() {
    const next = (node: HTMLElement) => {
      if (
        !node ||
        (node.classList && node.classList.contains(Const.elTableBodyWraper))
      )
        return;
      const height = node.style && node.style.height;
      if (height) {
        node.style.height = "auto";
      }
      if (node.hasChildNodes()) {
        const nodeQueue = Array.from(node.children);
        while (nodeQueue.length > 0) {
          const curNode = nodeQueue.shift();
          next(curNode as HTMLElement);
        }
      }
    };
    next(this.cloneEmptyTable as HTMLElement);
  }

  findRows(ele: HTMLElement) {
    const rows = ele.querySelectorAll(Const.cardTableTr) as any;
    return [...rows].map?.((item) => {
      item.parenttagName = item?.parentNode?.tagName
      return item;
    }) || []
  }

  cleanTbody(ele: HTMLElement) {
    const rows = ele.querySelectorAll(Const.cardTableTr);
    Array.from(rows)?.forEach((row) => {
      row.parentNode?.removeChild(row);
    });
  }

  createTBModule(cloneEmptyTable: Element) {
    const moduleTbWraper = document.createElement("div");
    // moduleTbWraper.setAttribute("style", "border: 3px solid yellow");
    const emptyTable = cloneEmptyTable?.cloneNode(true) as HTMLElement;
    moduleTbWraper.appendChild(emptyTable as HTMLElement);
    return moduleTbWraper;
  }
}
/**
 * 拆分table tbody
 */
// splitTbody(tbody: TbQueueItem, distance: number, tbBomHeight: number) {
//   if (tbBomHeight == null) tbBomHeight = 0;
//   const module = tbody.module;
//   const rowQueue = this.findRows(module);
//   let idx = 0;
//   this.cleanTbody(module);
//   this.cloneTable(module as HTMLElement);
//   distance = this.appendModule(
//     this.createTBModule(this.cloneEmptyTable as Element),
//     100,
//     ModuleType.TBODY
//   );
//   const next = () => {
//     if (idx >= rowQueue.length) return;
//     const row = rowQueue[idx++];
//     const height = (row as CurrentStyleElement).calcHeight;

//     if (distance > height + tbBomHeight) {
//       distance = this.appendModule(row, height, ModuleType.ROW);
//     } else {
//       distance = this.createWraper(module);
//       distance = this.appendModule(
//         this.createTBModule(this.cloneEmptyTable as Element),
//         100,
//         ModuleType.TBODY
//       );
//       distance = this.appendModule(row, height, ModuleType.ROW);
//     }
//     next();
//   };
//   next();
//   return distance;
// }
