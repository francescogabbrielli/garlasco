declare module 'ngeohash' {
  const geohash: {
    encode(latitude: number, longitude: number, precision?: number): string;
  };
  export default geohash;
}
