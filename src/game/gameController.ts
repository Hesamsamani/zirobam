import { formatNumber, t } from '../i18n';
import { BADGES } from './achievements';
import type { Award, GameStore, Stars } from './gameStore';
import type { ToastCenter } from './toastCenter';

export interface GameControllerDeps {
  store: GameStore;
  toasts: Pick<ToastCenter, 'show' | 'showXp'>;
}

/** Turns what the player does into rewards, and tells them about it. The app calls these, nothing else. */
export class GameController {
  readonly store: GameStore;
  private readonly toasts: Pick<ToastCenter, 'show' | 'showXp'>;

  constructor(deps: GameControllerDeps) {
    this.store = deps.store;
    this.toasts = deps.toasts;
  }

  answer(correct: boolean): Award {
    return this.announce(this.store.recordAnswer(correct));
  }

  levelPassed(level: number): Award {
    return this.announce(this.store.recordLevelPassed(level));
  }

  stepPassed(): Award {
    return this.announce(this.store.recordStepPassed());
  }

  songFinished(songId: string, stars: Stars): Award {
    return this.announce(this.store.recordSongFinished(songId, stars));
  }

  xyloSong(songId: string, stars: Stars): Award {
    return this.announce(this.store.recordXyloSong(songId, stars));
  }

  lessonsRead(): Award {
    return this.announce(this.store.recordLessonsRead());
  }

  stage(stage: number): Award {
    return this.announce(this.store.recordStage(stage));
  }

  private announce(award: Award): Award {
    if (award.xp > 0) this.toasts.showXp(award.xp);
    if (award.leveledUp) {
      this.toasts.show({
        kind: 'rank',
        title: t('game.toast.rankUp', { n: formatNumber(award.level) }),
        detail: t('game.toast.rankUpDetail'),
      });
    }
    for (const id of award.newBadges) {
      const badge = BADGES.find((b) => b.id === id);
      if (badge) {
        this.toasts.show({ kind: 'badge', title: t('game.toast.badge', { name: t(badge.title) }), detail: t(badge.desc) });
      }
    }
    if (award.goalReached) this.toasts.show({ kind: 'goal', title: t('game.toast.goal') });
    return award;
  }
}
