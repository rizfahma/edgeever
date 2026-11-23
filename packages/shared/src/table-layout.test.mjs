import { describe, expect, test } from "bun:test";
import {
  addTableField,
  addTableRecord,
  createDefaultTableDocument,
  getTableViews,
  parseTableDocument,
  removeTableField,
  saveTableViews,
  serializeTableDocument,
} from "./table.ts";

const withEndDate = () => addTableField(createDefaultTableDocument(), { id: "fld_end", name: "End", type: "date" });

describe("table view layouts", () => {
  test("board, calendar and timeline settings survive a save and parse", () => {
    const document = withEndDate();
    const [initial] = getTableViews(document);
    const saved = saveTableViews(document, [
      initial,
      { id: "board", name: "Board", match: "all", filters: [], sorts: [], layout: "board", groupFieldId: "fld_status" },
      { id: "cal", name: "Calendar", match: "all", filters: [], sorts: [], layout: "calendar", dateFieldId: "fld_date" },
      { id: "time", name: "Timeline", match: "all", filters: [], sorts: [], layout: "timeline", dateFieldId: "fld_date", endDateFieldId: "fld_end" },
    ]);
    const views = parseTableDocument(serializeTableDocument(saved)).views;
    expect(views[0].layout).toBeUndefined();
    expect(views[1]).toMatchObject({ layout: "board", groupFieldId: "fld_status" });
    expect(views[2]).toMatchObject({ layout: "calendar", dateFieldId: "fld_date" });
    expect(views[3]).toMatchObject({ layout: "timeline", dateFieldId: "fld_date", endDateFieldId: "fld_end" });
  });

  test("a single default view with a layout is not collapsed back to the legacy format", () => {
    const document = createDefaultTableDocument();
    const [initial] = getTableViews(document);
    const saved = saveTableViews(document, [{ ...initial, layout: "board", groupFieldId: "fld_status" }]);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.views[0].layout).toBe("board");
  });

  test("stale field references fall back to a suitable field instead of breaking the view", () => {
    const document = withEndDate();
    const [initial] = getTableViews(document);
    const saved = saveTableViews(document, [
      initial,
      { id: "board", name: "Board", match: "all", filters: [], sorts: [], layout: "board", groupFieldId: "fld_name" },
      { id: "time", name: "Timeline", match: "all", filters: [], sorts: [], layout: "timeline", dateFieldId: "fld_end", endDateFieldId: "fld_end" },
    ]);
    expect(saved.views[1].groupFieldId).toBe("fld_status");
    expect(saved.views[2]).toMatchObject({ dateFieldId: "fld_end" });
    expect(saved.views[2].endDateFieldId).toBeUndefined();
    const withoutEnd = parseTableDocument(serializeTableDocument(removeTableField(saved, "fld_end")));
    expect(withoutEnd.views[2]).toMatchObject({ layout: "timeline", dateFieldId: "fld_date" });
  });

  test("unknown layouts are ignored and the view stays a table", () => {
    const document = createDefaultTableDocument();
    const [initial] = getTableViews(document);
    const saved = saveTableViews(document, [initial, { id: "x", name: "X", match: "all", filters: [], sorts: [], layout: "gantt" }]);
    expect(saved.views[1].layout).toBeUndefined();
  });

  test("records can be added at the start or, by default, at the end", () => {
    const document = createDefaultTableDocument();
    expect(addTableRecord(document, "rec_last").records.map((record) => record.id)).toEqual(["rec_sample", "rec_last"]);
    expect(addTableRecord(document, "rec_first", "start").records.map((record) => record.id)).toEqual(["rec_first", "rec_sample"]);
  });
});
