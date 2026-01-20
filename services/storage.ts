
import { TestAttempt } from "../types";

const STORAGE_KEY = 'speaklevel_ai_history';

export const StorageManager = {
  saveAttempt: (attempt: TestAttempt) => {
    const history = StorageManager.getHistory();
    history.unshift(attempt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  },

  getHistory: (): TestAttempt[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  clearHistory: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  getAttemptById: (id: string): TestAttempt | undefined => {
    const history = StorageManager.getHistory();
    return history.find(a => a.id === id);
  }
};
