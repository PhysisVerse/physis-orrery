export type Bytes16 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function toUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function labelBytes(label: string): Bytes16 {
  const bytes = new TextEncoder().encode(label);

  const out: Bytes16 = [
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0,
  ];

  for (let i = 0; i < Math.min(bytes.length, 16); i += 1) {
	out[i] = bytes[i];
  }

  return out;
}
