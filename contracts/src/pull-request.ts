export type CiState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'NONE';

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  branch: string;
  target: string;
  author: string;
  authorAvatar: string;
  isMine: boolean;
  isDraft: boolean;
  hasConflicts: boolean;
  ciState: CiState;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}
