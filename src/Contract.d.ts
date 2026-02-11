/** Contract type for use in JSDoc across the codebase. */
export type Contract = {
  id: string;
  destinationKey: string;
  commodity: string;
  fulfilled: boolean;
  playerID: unknown;
};
