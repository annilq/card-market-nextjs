import * as migration_20261101_071941_init from './20261101_071941_init';
import * as migration_20261101_080000_search_indexes from './20261101_080000_search_indexes';
import * as migration_20261103_154633 from './20261103_154633';

export const migrations = [
  {
    up: migration_20261101_071941_init.up,
    down: migration_20261101_071941_init.down,
    name: '20261101_071941_init',
  },
  {
    up: migration_20261101_080000_search_indexes.up,
    down: migration_20261101_080000_search_indexes.down,
    name: '20261101_080000_search_indexes',
  },
  {
    up: migration_20261103_154633.up,
    down: migration_20261103_154633.down,
    name: '20261103_154633'
  },
];
