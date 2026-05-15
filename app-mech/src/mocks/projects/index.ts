import mockShopfront from "./mock-shopfront";
import mockAnalytics from "./mock-analytics";
import mockContentHub from "./mock-content-hub";

export { mockShopfront, mockAnalytics, mockContentHub };

export const allMockProjects = [mockShopfront, mockAnalytics, mockContentHub] as const;
