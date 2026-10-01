import PoolTypePage from '../components/PoolTypePage';
import { POOL_GALLERIES } from '../config/poolGalleries';
import { competitionPools } from '../content/pages/poolTypes';

export default function CompetitionSwimmingPools() {
  return (
    <PoolTypePage
      schema={competitionPools}
      poolType="competition"
      poolName="Competition Pools"
      gallery={POOL_GALLERIES.competition}
      layout="wide"
    />
  );
}
