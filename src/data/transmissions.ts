import type { Transmission } from '../game/types';

/** The archive stores stable IDs so new epochs can add fragments without invalidating saves. */
export const TRANSMISSIONS: Transmission[] = [
  {
    id: 'launch-orders',
    sender: 'CMDR. VOLKOV',
    title: 'LAST FLIGHT ORDER',
    frequency: '141.80 MHz / MIRNY-7',
    afterLevel: 0,
    text: 'Voss. Strelka-9 is the last airframe that still answers to a human hand.\n\nThe orbital program was abandoned nineteen years ago. Tonight every gun on it turned toward Earth. No uplink. No command authority. Just the same repeating Signal.\n\nFollow it through the perimeter. Find what is giving the orders. Bring your ship home.',
  },
  {
    id: 'cold-start',
    sender: 'DR. KALININA / RECOVERED TAPE',
    title: 'COLD START',
    frequency: '09.71 MHz / ENGINE TELEMETRY',
    afterLevel: 1,
    text: 'The Strelka engine started again this morning. Fuel valves closed. Battery disconnected.\n\nIt waited until I spoke your callsign.\n\nVoss, if this recording reaches you, inspect the amber clock below the weapons panel. Mine has been counting backward since the first Signal. It is almost at zero.',
  },
  {
    id: 'voss-echo',
    sender: 'PILOT VOSS / ID VERIFIED',
    title: 'YOUR VOICE, SIX MINUTES AHEAD',
    frequency: '121.50 MHz / DISTRESS',
    afterLevel: 3,
    text: 'This is Voss. Strelka-9. Do not fire at the light inside the wall.\n\nThe machines are not guarding a border. They are holding a formation for something that has not arrived yet. Every empty position is the shape of our ship.\n\nVolkov, you told me to come home. Which time did you mean?',
  },
  {
    id: 'open-channel',
    sender: 'THE SIGNAL / NO CARRIER',
    title: 'CHANNEL OPEN',
    frequency: '00.00 MHz / SOURCE UNRESOLVED',
    afterLevel: 5,
    text: 'The defense array goes dark. Behind it, Earth is silent and violet.\n\nA new line appears on the amber display. No sender. No timestamp.\n\nSTRELKA-9: RECOGNIZED.\nPILOT VOSS: RETURN CONFIRMED.\n\nThen Kalinina’s clock begins to count forward.',
  },
];
