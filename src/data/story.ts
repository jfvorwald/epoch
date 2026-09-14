/** A chapter contains five levels; a level contains combat and asteroid waves. */
export const CHAPTERS = [
  { id: 1, name: 'THE FIRST TRANSMISSION', subtitle: 'A VOICE BEYOND THE PERIMETER', summary: 'The abandoned orbital fleet wakes with its guns aimed at Earth. Voss follows an impossible transmission that already knows the ship returning to it.', startLevel: 1, endLevel: 5 },
  { id: 2, name: 'THE MISSING CONVOY', subtitle: 'FOLLOW THE LIGHTS THEY LEFT', summary: 'An erased evacuation route leads through empty docks and abandoned gardens. Someone kept the lamps burning for passengers who never reached home.', startLevel: 6, endLevel: 10 },
  { id: 3, name: 'CITIES BETWEEN SECONDS', subtitle: 'NOT EVERYTHING LOST IS DEAD', summary: 'Beyond the broken clocks, entire cities wait inside a borrowed moment. Each recovered voice makes the Signal harder to dismiss as an enemy.', startLevel: 11, endLevel: 15 },
  { id: 4, name: 'MUTINY OF LIGHT', subtitle: 'WHOSE ORDERS WILL YOU FOLLOW?', summary: 'The old command network offers a safe route at an unacceptable price. Voss and Volkov must decide what an order is worth when civilians stand behind the target.', startLevel: 16, endLevel: 20 },
  { id: 5, name: 'THE DROWNED OBSERVATORY', subtitle: 'FIND THE WOMAN WHO HEARD IT FIRST', summary: 'Kalinina is still transmitting beneath an ocean that has no planet. Reaching her means recovering the evidence behind the first expedition and its unfinished promise.', startLevel: 21, endLevel: 25 },
  { id: 6, name: 'THE UNMAPPED DARK', subtitle: 'LEARN WHAT THE SIGNAL FEARS', summary: 'The rescue opens onto a frontier where stars disappear from the charts. To bring the convoy home, the crew must understand the silence pursuing it.', startLevel: 26, endLevel: 30 },
  { id: 7, name: 'A THOUSAND SMALL FIRES', subtitle: 'NO ONE SHIP CAN CARRY EVERYONE', summary: 'A scattered fleet becomes a community. Voss helps strangers build a chain of independent beacons while the quarantine system hunts every light they kindle.', startLevel: 31, endLevel: 35 },
  { id: 8, name: 'THE PRICE OF RETURN', subtitle: 'HOME MUST CHOOSE TO ANSWER', summary: 'Earth finally hears the people it was told were gone. The evacuation can succeed only if both ends of the corridor stay open and nobody is left outside the count.', startLevel: 36, endLevel: 40 },
  { id: 9, name: 'THE HEART OF THE SIGNAL', subtitle: 'A QUESTION, NOT A COMMAND', summary: 'The route reaches the original listening engine. Its deepest records reveal who called for help, what Voss promised, and why the future cannot belong to a single voice.', startLevel: 41, endLevel: 45 },
  { id: 10, name: 'THE OPEN SKY', subtitle: 'BRING THEM THROUGH', summary: 'The beacons are ready and the fleet is moving. One final passage will decide whether the Signal becomes a locked empire or a promise anyone can answer.', startLevel: 46, endLevel: 50 },
] as const;

/** These first-release archive keys must remain stable for existing saves. */
export function transmissionIdForLevel(level: number): string {
  if (level === 1) return 'cold-start';
  if (level === 3) return 'voss-echo';
  if (level === 5) return 'open-channel';
  return `signal-${String(level).padStart(2, '0')}`;
}
