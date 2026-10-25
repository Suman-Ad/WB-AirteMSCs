import {useEffect, useState} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import {normalizePowerMapping} from '../components/powerMeterMapping';

export default function useSitePowerMapping(siteId) {
  const [state, setState] = useState({siteId:null, config:normalizePowerMapping(), ready:false, error:''});
  useEffect(() => {
    let active=true;
    setState({siteId, config:normalizePowerMapping(), ready:false, error:''});
    if (!siteId) return;
    const stop=onSnapshot(doc(db,'energyMonitor',siteId,'config','powerSwitch'), {includeMetadataChanges:true}, snapshot => {
      if (!active) return;
      const confirmed=!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      const exists=snapshot.exists();
      // Until an authorized user publishes site settings, no device can auto-switch using private mappings.
      const config=normalizePowerMapping(exists ? snapshot.data() : {enabled:false});
      setState({siteId,config,exists,ready:confirmed,error:''});
    }, error => {
      if (active) setState({siteId,config:normalizePowerMapping({enabled:false}),ready:false,error:`Automatic switch settings unavailable: ${error.message || error.code || 'connection failed'}`});
    });
    return () => {active=false;stop();};
  }, [siteId]);
  return state.siteId === siteId ? state : {config:normalizePowerMapping(),ready:false,error:''};
}
