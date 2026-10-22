export interface CheckIn {
  id: string;
  memberId: string;
  subscriptionId: string;
  visitDate: string;
}

export interface VisitUsage {
  alreadyCheckedIn: boolean;
  visitsBySubscription: Readonly<Record<string, number>>;
}
