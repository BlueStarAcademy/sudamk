import React from 'react';
import PairWaitingLobby, { type PairWaitingLobbyProps } from '../PairWaitingLobby.js';

export type HomeWaitingLobbyEmbedProps = PairWaitingLobbyProps;

/** 홈 중앙 퀵유틸 뷰어용 — PairWaitingLobby를 센터 컬럼만 표시 */
const HomeWaitingLobbyEmbed: React.FC<HomeWaitingLobbyEmbedProps> = (props) => (
    <PairWaitingLobby {...props} presentation="homeViewer" />
);

export default HomeWaitingLobbyEmbed;
