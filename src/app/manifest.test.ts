import manifest from "./manifest";

describe("PWA manifest", () => {
  it("exposes a standalone install with standard and maskable logo icons", () => {
    const value = manifest();

    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.theme_color).toBe("#006bb6");
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/pwa-icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/pwa-icon-512.png", sizes: "512x512" }),
      expect.objectContaining({ src: "/pwa-icon-maskable-512.png", purpose: "maskable" })
    ]));
  });
});
