import Const from "./const";
import { calcHeight, findTplTag } from "./utils";
import {
  CurrentStyleElement,
  PrintTemplatesTag,
  TbModuleInfo,
  TplMap,
} from "../index";
import PdfPage from "./PdfPage";

export default class DfsChild extends PdfPage {
  constructor() {
    super();
  }
  childMap = new Map();
  static headerTplMap = new Map();
  static footerTplMap = new Map();
  flagNum = 0; // 只是为了方便 排查分页后的打印数据 中的模块 和页面元素的 之间的对应关系
  time = 1;
  walk(ele: HTMLElement) {
    this.time++;
    if (ele.hasChildNodes()) {
      const nodeQueue = Array.from(ele.children);
      while (nodeQueue.length > 0) {
        const node = nodeQueue.shift();
        if (node?.classList.contains(Const.spliteFlag)) {
          this.setPagesMap(node as HTMLElement);
          continue;
        } else {
          this.walk(node as HTMLElement);
        }
      }
    } else {
      this.setPagesMap(ele as HTMLElement);
    }
  }

  setPagesMap(ele: HTMLElement) {
    if (ele.classList.contains(Const.spliteFlag) && !this.childMap.has(ele)) {
      ele.classList.add(`flagNum-${this.flagNum++}`);
      this.childMap.set(ele, this.getModuleInfo(ele));
    }
  }

  isModuleHasTable(ele: HTMLElement, hasTable = false) {
    for (let index = 0; index < ele.childNodes.length; index++) {
      const item: any = ele.childNodes[index];
      if (item.classList?.contains?.(Const.tableClass)) {
        hasTable = true;
      }
    }
    return hasTable;
  }

  getChildrenModuleInfo(ele: HTMLElement) {
    ele.childNodes.forEach((item: any) => {
      const isTable = item.classList.contains(Const.tableClass);
      let hasSubTable = false;
      hasSubTable = this.isModuleHasTable(item);
      if (isTable && !this.childMap.has(item)) {
        const height = calcHeight(item);
        this.childMap.set(item, {
          tableModuleInfo: this.getTableModuleInfo(item, height),
          height,
          isTable: hasSubTable,
        });
      }
      if (hasSubTable) {
        this.getChildrenModuleInfo(item)
      }
    });
  }

  getModuleInfo(ele: HTMLElement) {
    const isTable = ele.classList.contains(Const.tableClass);
    const moduleInfo = {
      height: calcHeight(ele),
      isTable,
      tableModuleInfo: {},
    };
    if (isTable) {
      moduleInfo.tableModuleInfo = this.getTableModuleInfo(
        ele,
        moduleInfo.height
      );
    } else {
      this.getChildrenModuleInfo(ele);
    }
    return moduleInfo;
  }

  getTableModuleInfo(ele: HTMLElement, height: number) {
    console.log("getTableModuleInfo ele", ele);
    const tbModuleInfo: TbModuleInfo = {
      tbTopInfo: this.getEleHeight(ele, Const.cardTableTopWraper),
      tbHeader: this.getEleHeight(ele, Const.cardTableTBHeaderWraper),
      table: this.getEleHeight(ele, Const.cardTableWraper),
      tbBomInfo: this.getEleHeight(ele, Const.cardTableBomWraper),
      minHeight: 0,
      marginPadHeight: 0,
    };
    let expandRow = ele.classList.contains(Const.tableRowExpand);
    // console.log("getMinHeight tbModuleInfo", tbModuleInfo);
    tbModuleInfo.minHeight = this.getMinHeight(
      ele,
      tbModuleInfo as unknown as TbModuleInfo,
      height,
      expandRow
    );
    let needMerge = ele.classList.contains(Const.tableRowSpanMerge);
    if (needMerge) {
      this.setRowSpanMergeInfo(ele);
    }
    let marginPadHeight =
      height -
      (tbModuleInfo.tbTopInfo.height +
        tbModuleInfo.table.height +
        tbModuleInfo.tbBomInfo.height);
    tbModuleInfo.marginPadHeight = marginPadHeight;
    tbModuleInfo.needMerge = needMerge;

    tbModuleInfo.expandRow = expandRow;
    return tbModuleInfo;
  }
  /**
   * minHeight 最小高度 = topInfoHeight + tbHeaderheight + row * minRowsCount
   */
  getMinHeight(
    ele: HTMLElement,
    tbModuleInfo: TbModuleInfo,
    height: number,
    expandRow = false
  ) {
    const nodes = Array.from(ele.querySelectorAll(Const.cardTableTr));
    const { tbTopInfo, tbHeader } = tbModuleInfo;
    let threeRowHeight = 0;

    if (nodes.length > Const.minRowsCount) {
      nodes.forEach((node, index) => {
        if (index < Const.minRowsCount) {
          threeRowHeight += calcHeight(node as HTMLElement) || 0;
        }
        (node as any).calcHeight = node.clientHeight;
        if (expandRow) {
          if (index % 4 < 3 && index % 4 > 0) {
            node.classList.add(Const.cardTableTr4n);
          }
        }
      });
      return tbTopInfo.height + tbHeader.height + threeRowHeight;
    } else {
      nodes.forEach((node, index) => {
        (node as any).calcHeight = node.clientHeight;
      });
      return height;
    }
  }

  setRowSpanMergeInfo(ele: HTMLElement) {
    let needMerge = ele.classList.contains(Const.tableRowSpanMerge);
    if (needMerge) {
      const rows = ele.querySelectorAll(Const.cardElRowClass);
      const mergeTdArgs = [];
      let num = 0;
      let totalRowSpan = 1;
      rows.forEach((row, rowIndex) => {
        const tds = row.children;
        let mergedInfo = {
          needMergeRow: false,
          rowIndex,
          tdIndex: null,
          needRowSpanNum: 1,
          isLeftRow: false,
        };

        if (num > 1) {
          num--;
          Object.assign(mergedInfo, {
            needMergeRow: true,
            isLeftRow: true,
            rowIndex,
            tdIndex: null,
            needRowSpanNum: num,
          });
        } else {
          Array.from(tds).forEach((td: Element, tdIndex) => {
            const rowSpan = Number((td as HTMLElement).getAttribute("rowspan"));
            if (rowSpan > 1) {
              num = rowSpan;
              Object.assign(mergedInfo, {
                needMergeRow: true,
                rowIndex,
                tdIndex,
                needRowSpanNum: Number(rowSpan),
              });
              totalRowSpan = rowSpan;
            }
          });
        }
        (row as CurrentStyleElement).mergedInfo = mergedInfo;
        // row.rowIndex = rowIndex;
        // row.needMergeRow = needMergeRow;
        // row.mergeTdArgs = mergeTdArgs;
      });
    }
    return needMerge;
  }

  getEleHeight(ele: HTMLElement, className: string) {
    const modules: any = ele.querySelectorAll("." + className);
    let height = 0;
    modules.forEach((module: any) => {
      module.height = calcHeight(module);
      height += calcHeight(module);
    });
    if (ele && modules) {
      return {
        modules,
        height,
      };
    } else {
      return {
        modules,
        height: 0,
      };
    }
  }

  static getTpl() {
    const headerTpls = this.getChildTpls(
      PrintTemplatesTag.printHeadertemplates
    );
    const footerTpls = this.getChildTpls(
      PrintTemplatesTag.printFooterTemplates
    );
    this.headerTplMap.size === 0 &&
      this.setTplFunc(headerTpls as Element[], this.headerTplMap);
    this.footerTplMap.size === 0 &&
      this.setTplFunc(footerTpls as Element[], this.footerTplMap);

    // console.log("this.headerTplMap", this.headerTplMap);
    // console.log("this.headerTplMap", this.footerTplMap);
  }

  static setTplFunc(tpls: Element[], map: TplMap) {
    tpls.forEach((tpl: ChildNode) => {
      const flag = findTplTag(tpl as Element);
      if (flag && !map.has(flag)) {
        map.set(flag, {
          tpl: tpl as Element,
          height: (tpl as HTMLDivElement).offsetHeight,
        });
      }
    });
  }
  static getChildTpls(flag: string) {
    const ele = document.getElementById(flag);
    if (ele) {
      return ele.childNodes;
    }
    return [];
  }
}
