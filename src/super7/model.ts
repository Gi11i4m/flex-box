export enum Super7EventStatus {
  RESERVED = '✅',
  WAITLIST = '⏳',
}

export interface Super7Event {
  title: string;
  location: 'Leuven' | 'Aarschot';
  start: Date;
  status: Super7EventStatus;
}
