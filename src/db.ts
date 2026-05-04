import Dexie, { type Table } from 'dexie';

export interface Photo {
  id: string;
  fileName: string;
  src: string; // base64 full image
  thumbnail: string;
  createdAt: number;
  dayIndex?: number; // which day of the trip
  caption?: string;
}

export interface TripDay {
  index: number;
  title: string;
  description: string;
  photoIds: string[];
}

export interface Trip {
  id: string;
  title: string;
  subtitle: string;
  coverPhotoId?: string;
  startDate?: number;
  endDate?: number;
  location?: string;
  days: TripDay[];
  photoIds: string[];
  template: 'magazine' | 'minimal' | 'scrapbook';
  createdAt: number;
  updatedAt: number;
}

class TravelDB extends Dexie {
  photos!: Table<Photo>;
  trips!: Table<Trip>;

  constructor() {
    super('TravelJournal');
    this.version(1).stores({
      photos: '++id, createdAt',
      trips: '++id, createdAt, updatedAt',
    });
  }
}

export const db = new TravelDB();
