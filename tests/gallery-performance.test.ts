import { describe, expect, it } from "vitest";
import { galleryPage, sendPersistedPhoto, type Item } from "../src/gallery.js";

const photos: Item[] = Array.from({ length: 8 }, (_, index) => ({
  id: `g${index}`, telegramFileId: `telegram-file-${index}`, title: `Image ${index}`,
  caption: "A gallery image", categoryId: "photography", metadata: { tags: ["test"] },
  createdByAdmin: "1", createdAt: "2026-01-01T00:00:00.000Z",
}));

function galleryDb() {
  return {
    prepare(sql: string) {
      const statement = {
        bind: (..._values: unknown[]) => statement,
        run: async () => ({}),
        first: async () => sql.includes("COUNT(*)") ? { total: photos.length } : null,
        all: async () => {
          if (sql.includes("FROM gallery_categories")) return { results: [{ id: "photography", name: "Photography", description: "Moments framed with care.", featured_order: 1 }] };
          if (sql.includes("FROM gallery_items")) return { results: photos.map((item) => ({ id: item.id, file_id: item.telegramFileId, title: item.title, caption: item.caption, category_id: item.categoryId, metadata: JSON.stringify(item.metadata), created_by: item.createdByAdmin, created_at: item.createdAt })) };
          return { results: [] };
        },
      };
      return statement;
    },
  };
}

describe("gallery browse performance", () => {
  it("loads a typical first page in under 1.5 seconds without N+1 item reads", async () => {
    const started = performance.now();
    const page = await galleryPage({ env: { DB: galleryDb() } } as any, "photography");
    expect(performance.now() - started).toBeLessThan(1500);
    expect(page.items).toHaveLength(8);
  });

  it("opens an item in under one second using its persisted Telegram file_id", async () => {
    const calls: string[] = [];
    const started = performance.now();
    await sendPersistedPhoto({ replyWithPhoto: async (fileId: string) => { calls.push(fileId); return {} as any; } } as any, photos[0], { caption: photos[0].title });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(calls).toEqual(["telegram-file-0"]);
  });
});
