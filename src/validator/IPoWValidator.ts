
export interface IPoWValidatorValidateRequest {
  shareId: string;
  nonces: number[];
  preimage: string;
  params: {
    n: number; // cpu and memory cost
    r: number; // block size
    p: number; // paralellization
    l: number; // key length
    d: number; // difficulty
  };
}