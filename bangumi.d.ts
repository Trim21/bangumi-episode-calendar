export interface Collection {
  updated_at: Date;
  comment: string | null;
  tags: any[];
  subject_id: number;
  ep_status: number;
  vol_status: number;
  subject_type: number;
  type: number;
  rate: number;
  private: boolean;
}

export interface Subject {
  name: string;
  name_cn: string;
  id: number;
  total_episodes: number;
}

export interface Episode {
  airdate: string;
  name: string;
  name_cn: string;
  duration: string;
  desc: string;
  ep: number;
  sort: number;
  id: number;
  subject_id: number;
  comment: number;
  type: number;
  disc: number;
}

export interface Paged<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
