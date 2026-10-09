export const shouldFailTileProvider = (successfulTiles: number, failedTiles: number): boolean =>
  successfulTiles === 0 && failedTiles > 0;
