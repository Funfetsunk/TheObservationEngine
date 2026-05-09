export interface WsTickMessage {
  type: 'tick';
  tick: number;
  simulatedAt: string;
  citizens: {
    id: string;
    name: string;
    districtId: string;
    activity: string;
    positionX: number;
    positionY: number;
  }[];
}

export interface WsEventMessage {
  type: 'event';
  eventId: string;
  eventType: string;
  significance: number;
  districtId: string | null;
  citizenIds: string[];
  citizenNames: string[];
}

export interface WsEditionMessage {
  type: 'edition';
  editionId: string;
  editionNumber: number;
  publishedAt: string;
}

export interface WsConnectedMessage {
  type: 'connected';
  message: string;
}

export type WsMessage = WsTickMessage | WsEventMessage | WsEditionMessage | WsConnectedMessage;
