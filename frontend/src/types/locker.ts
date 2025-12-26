export type Locker = {
  lock_id: string;
  device_id: string;
  name?: string;
  status: string;
  mode: string;
  occupied: boolean;
  last_action?: string;
  last_action_time?: string;
};

