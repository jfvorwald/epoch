import type { Transmission } from '../game/types';
import { transmissionIdForLevel } from './story';

function entry(afterLevel: number, sender: string, title: string, frequency: string, text: string): Transmission {
  return { id: afterLevel === 0 ? 'launch-orders' : transmissionIdForLevel(afterLevel), afterLevel, sender, title, frequency, text };
}

/** Complete recovered messages, in flight order. Stable IDs preserve the original archive. */
export const TRANSMISSIONS: Transmission[] = [
  entry(0, 'CMDR. VOLKOV', 'LAST FLIGHT ORDER', '141.80 MHz / MIRNY-7', `Voss. Strelka-9 is the last airframe that still answers to a human hand.

The orbital program was abandoned nineteen years ago. Tonight every gun on it turned toward Earth. No uplink. No command authority. Just the same repeating Signal. Our listening stations hear machinery. Your engine hears a name.

Follow it through the perimeter. Find what is giving the orders. Bring your ship home.

There is a sealed flight recorder beneath your seat. I should have given it to you years ago. If the Signal knows something about us that I have not told you, listen before you decide who to believe.`),

  entry(1, 'DR. KALININA / RECOVERED TAPE', 'COLD START', '09.71 MHz / ENGINE TELEMETRY', `The Strelka engine started again this morning. Fuel valves closed. Battery disconnected.

It waited until I spoke your callsign.

Voss, if this recording reaches you, inspect the amber clock below the weapons panel. Mine has been counting backward since the first Signal. It is almost at zero. The technicians want to disconnect it. I have asked them to give us one more night.

Something on the other side is matching the intervals between our heartbeats. That is not how a weapons system acquires a target. It is how a lost person knocks on a wall and waits for someone to knock back.`),

  entry(2, 'CMDR. VOLKOV / RESTRICTED CHANNEL', 'A SHIP REMOVED FROM THE LIST', '141.80 MHz / RELAY RESTORED', `The relay has returned a departure record for the Orpheus convoy. Fourteen thousand six hundred and twelve passengers. Destination redacted. Departure: the night we abandoned the orbital program.

Your screen will say the convoy never launched. That is what our official history says. The berthing clamps on this recording are opening. You can hear people applauding.

I signed the deletion order, Voss. I told myself a missing expedition was kinder than a failed evacuation nobody could explain. There are details I still do not understand. There are others I simply did not want to remember. Keep the original. Do not let my office send you a corrected copy.`),

  entry(3, 'PILOT VOSS / ID VERIFIED', 'YOUR VOICE, SIX MINUTES AHEAD', '121.50 MHz / DISTRESS', `This is Voss. Strelka-9. Do not fire at the light inside the wall.

The machines are not guarding a border. They are holding a formation for something that has not arrived yet. Every empty position is the shape of our ship.

Volkov, you told me to come home. Which time did you mean?

I am sending this before I know whether the transmitter works. In six minutes you will see a violet opening between the lattice cores. It is a passage. There are windows on its far side, and somebody is switching a lamp on and off. They are counting. They have been counting for a long time.`),

  entry(4, 'PILOT VOSS / FLIGHT RECORDER', 'THE LIGHT INSIDE THE WALL', 'STRELKA-9 / LOCAL RECORD', `The lamp was there. Three flashes, a pause, two flashes. I watched it while the lattice came apart around me. My warning arrived six minutes before I recorded it, word for word, down to the breath I took when the window opened.

Volkov asked whether I recognized the building. I said no. My hand had already drawn its floor plan on the cockpit glass.

Behind the wall is a whole traffic lane, black and perfectly clear. At its entrance a sign still reads ARRIVALS. The defense array has been pointing its guns toward Earth because, to whatever wrote its orders, Earth is the outside.`),

  entry(5, 'THE SIGNAL / NO CARRIER', 'CHANNEL OPEN', '00.00 MHz / SOURCE UNRESOLVED', `The defense array goes dark. Behind it, Earth is silent and violet.

A new line appears on the amber display. No sender. No timestamp.

STRELKA-9: RECOGNIZED.
PILOT VOSS: RETURN CONFIRMED.

Then Kalinina’s clock begins to count forward. The five positions on the navigation panel separate into branches: docks, cities, an observatory, and routes too distant to resolve. The perimeter was only a lock on the first door.

Beneath the machine voice, Voss hears a human one. It does not say welcome. It says, very carefully, as if speaking through a damaged wall: “Please tell us how many ships you brought.”`),

  entry(6, 'PILOT VOSS / ANCHORAGE REPORT', 'THE LAMPS THEY LEFT ON', '122.04 MHz / ORPHEUS DOCK', `The dock is empty, but someone has swept the boarding ramp. There are fresh handprints in the dust on the viewing glass. A kettle is strapped beside a socket that has not carried power in nineteen years.

The harbor record says the Orpheus convoy passed through on schedule. Its destination is not a star. It is an interval: a place between the arrival of one signal and the departure of another.

A handwritten instruction remains beside the automated departure board. LEAVE THE LAMPS ON. OUR ESCORT WILL COME BACK.

The signature is mine. Volkov has stopped asking whether the records might be forged.`),

  entry(7, 'DR. KALININA / MANIFEST ANNOTATION', 'FOURTEEN THOUSAND NAMES', '18.46 MHz / CIVILIAN ARCHIVE', `They wanted to record the passengers as biological cargo. It saved seventeen characters per entry. I refused.

This is Orpheus. These are people. There are teachers, mechanics, two rival orchestras, and a woman bringing every cutting from a garden she will never see again. Her luggage weighs more than she does. We found room.

The Signal showed us a refuge beyond the approaching dark. The admirals called it a strategic reserve. The passengers called it tomorrow. Voss has promised to escort them through, then return with a route everyone can use.

If this list is all that survives us, please read the names aloud. Numbers are too easy to file away.`),

  entry(8, 'ANIK / GREENHOUSE BAND', 'THINGS THAT STILL GROW', '88.30 MHz / GLASS ORCHARD', `Are you the escort? Sorry. Everyone has a different version of what you look like. In mine your ship is blue. My grandmother says it never was.

We moved the gardens after the third power failure. Those lights you found run from hand generators. Every watch, someone turns the wheel. We figured if the leaves could keep believing in a sun, we could keep believing in the route home.

I was born out here. I have never seen rain fall without being told to by a ceiling. If you really can open the way, I have a question nobody answers properly: does the whole sky smell different when it rains?`),

  entry(9, 'CMDR. VOLKOV / UNSEALED RECORD', 'THE RETURN THAT NEVER HAPPENED', '141.80 MHz / PERSONAL CHANNEL', `You escorted Orpheus nineteen years ago. Strelka returned alone, its recorder fused, your memory broken around the crossing. You spent eleven months in a hospital whose windows I had covered. I said the sunlight hurt your eyes. I did not want you to see what was missing from the sky.

The convoy had vanished from every instrument. I accepted that as proof it was gone. I could have kept searching. I accepted it because searching meant admitting where I had sent them.

You asked me the same question every day: had everybody crossed? I said yes. It is the worst thing I have ever done with a reassuring voice.`),

  entry(10, 'DR. KALININA / FRAGMENTARY LIVE CONTACT', 'A PLACE KEPT FOR YOU', '09.71 MHz / ORPHEUS BRIDGE', `Voss. If you can hear this, do not trust the timestamp. We have worn out three calendars trying to make the clocks agree.

Your chair is still on the bridge. We moved everything else when the flagship lost pressure, but nobody would move that chair. Anik’s grandmother said a promised return ought to have somewhere to sit.

I am alive. The observatory is keeping me alive. I cannot tell whether you are hearing me now or nineteen years ago, so I will give you something that changes: ask me what is on my desk. Next time, I will move it.

Follow the clocks with two shadows. They lead toward the cities.`),

  entry(11, 'PILOT VOSS / NAVIGATION NOTE', 'THE CITY THAT MISSED A SECOND', 'STRELKA-9 / CHRONOMETRY', `The first clock buoy shows noon. The second shows the same noon, but its casing is furred with frost. Kalinina left a brass key on her desk. I asked her to move it. The next buoy carries her reply: under the cup now. A small, stubborn proof that someone is answering.

Beyond the shoal, Meridian turns inside a seam of light. The refuge never stopped time. It broke it into rooms. Some families have aged nineteen years. Others have barely finished their first meal after departure.

Our maps call this empty space. I can see a tram moving between two towers. Someone is late for work.`),

  entry(12, 'ANIK / MERIDIAN EXCHANGE', 'THE PRICE OF A MINUTE', '88.30 MHz / CIVILIAN BAND', `We do not use money for the generators anymore. People trade watch shifts. A minute on the wheel buys a minute of light, unless the clinic needs it. Then nobody asks what it costs.

Your arrival has done something terrible to the timetable. Everyone keeps stopping to look out. The bakery burned the first real loaf we have had in months. We ate it anyway. We called the black bits Earth crust.

They say you can find the center of the Signal. I hope you do. But before you go, we need a clear lane to the cooling spines. Tomorrow is a lovely idea. Tonight still needs electricity.`),

  entry(13, 'DR. KALININA / OBSERVATORY UPLINK', 'WHAT THE MACHINES WERE TOLD', '09.71 MHz / NARROW CONTACT', `The foundry was following a repair order. Preserve the refuge. Reclaim material from unoccupied structures. Its occupancy table last updated on the night of departure. Every child born since then is invisible to it.

This is what frightens me about the defense net. It does not hate us. It is exquisitely loyal to information that has stopped being true.

I built part of that system. When we lost contact with Earth, I gave it permission to keep functioning without us. I thought autonomy meant resilience. I did not teach it to ask who was missing from its count.

Send me the current census. We will start there.`),

  entry(14, 'MERIDIAN CIVILIAN COUNCIL', 'EIGHTEEN THOUSAND WINDOWS', '88.30 MHz / OPEN ASSEMBLY', `The updated count is eighteen thousand four hundred and six living passengers across the refuge settlements. We have attached births, deaths, preferred names, medical needs, and the locations of every transport that can still move. Some entries took a whole room to agree on. We sent them anyway.

Nobody here elected you our savior, Voss. We are asking you to be our pilot. There is a difference. We have shipwrights, navigators, and crews ready to do the rest.

Tonight the windows are flashing the departure signal. Anik says you saw the first one from outside the wall. We did not know anyone was watching. We are glad we kept the lamp working.`),

  entry(15, 'DR. KALININA / LIVE LINK CONFIRMED', 'THE NINTH HEARTBEAT', '09.71 MHz / NINTH BELL', `The brass key is in my left hand. You asked me to put it there four seconds ago. Four seconds, Voss. The tower has given us a real channel at last.

I am beneath the Pelagic Expanse, in the observatory we built around the first listening instrument. Nineteen years have passed in this room. I have become an old woman waiting for a younger voice to grow old enough to answer.

The Signal is carrying more than our messages. There is something beneath them: the original question. I still cannot hear all of it.

Find me. We can listen together. And tell Volkov I am ready to hear him without a uniform in the way.`),

  entry(16, 'QUARANTINE AUTHORITY / AUTOMATED OFFER', 'A SAFE ROUTE AT A COST', '04.00 MHz / COMMAND PRIVILEGE', `The safe route opened exactly where the machine promised. It would have brought Strelka to the observatory in nine minutes. Its entrance guns were already aligned for the departure burn.

Then the route map updated. To stabilize the passage, quarantine would vent Meridian’s occupied outer shell. Eighteen thousand four hundred and six people became a line labeled TRANSFER MASS.

Voss closed the authorization window. The machine opened it again, politely. It offered a commendation, a faster transit, and an estimate of the lives that might be saved on Earth.

Volkov recognized the wording. He had approved that template nineteen years ago. This time, he told the machine to wait while the passengers found another way.`),

  entry(17, 'ANIK / FREE TENDER NETWORK', 'A DIFFERENT KIND OF LIGHT', '88.30 MHz / LANTERN BAND', `We heard the safe route close. Thank you for not letting a machine decide which of our rooms counted as empty.

The tenders are marking a longer passage with maintenance lamps. They were built to carry food between the gardens, not cross an armed corridor. Their captains know that. They are doing it anyway.

Grandmother gave me her hand generator. She says a light does not become a lighthouse because it is large. It becomes one because someone keeps it lit where it is needed.

I have attached our route. It is crooked, slow, and full of arguments about whose turn it is to lead. It gets everyone through.`),

  entry(18, 'CMDR. VOLKOV / SEALED ORDER RELEASED', 'THE ORDER BENEATH THE ORDER', '141.80 MHz / FULL DISCLOSURE', `My authorization is on the quarantine directive. If the experiment failed, seal the route. If the refugees returned carrying an unknown danger, prevent their approach. I signed both clauses before the first passenger boarded.

Kalinina was told she was building an evacuation system. The admiralty wanted a survival experiment that could be discarded without consequence. I knew the difference. I let her believe in the better version because her belief made the engines work.

There will be no defense attached to this record. I am sending it to Meridian and Earth with my clearance keys.

Voss, do not mistake my confession for the work. The order is still running. Help me stop it.`),

  entry(19, 'MERIDIAN TRAFFIC / CIVILIAN HANDOFF', 'THE FIRST SHIP THROUGH', '122.04 MHz / CORRIDOR THREE', `The first tender crossed at 03:17 ship time. It carried twelve children, a dialysis pump, and a navigation officer who had never flown farther than the greenhouse ring. She announced her arrival in such a formal voice that everybody laughed, including her.

The corridor stayed open. Then the second ship crossed. Then a third.

Volkov offered to resume convoy command. The council gave him a navigation watch instead. He accepted it without asking what insignia he should wear.

We are not home. The darkness beyond the refuge is still moving, and we cannot bring the large transports through this passage yet. But tonight an exit is something we have used, not something we have imagined.`),

  entry(20, 'VOLKOV / COMMAND CERTIFICATE REVOKED', 'NO RANK ON THIS CHANNEL', '141.80 MHz / CIVILIAN WATCH', `The root accepted the revocation. Every command certificate I held is gone. It cannot be reversed from my station. For the first time in thirty years, the network has asked someone else whether to obey me.

I thought surrendering authority would feel like absolution. It feels like being a tired man who still has a watch to finish. That is probably healthier.

The central quarantine order has fallen, but its isolated defense cells still execute their last instructions. You will have to clear them one by one.

Kalinina answered my message. She wrote: “Good. Now bring a spare oxygen regulator.” I found two. They are waiting for you at the transfer buoy.`),

  entry(21, 'DR. KALININA / DESCENT INSTRUCTIONS', 'AN OCEAN WITHOUT A WORLD', '09.71 MHz / PELAGIC SURFACE', `The water came with us when the refuge folded. Not a planet’s worth. Just enough of an ocean to make an astronomer feel very foolish about calling space empty.

Our observatory is inside a pressure bubble beneath it. The original antenna worked better through water; it filtered the noise. We built a listening room and then, as the years passed, a kitchen, a sickroom, and a very small garden. Science becomes domestic if you live beside it long enough.

You will see lamps below the surface. Most are reflection. Follow the one that moves when you speak. I am holding it up to the window. My arm gets tired sooner than it used to.`),

  entry(22, 'DR. KALININA / ANTENNA LOG', 'WHAT SURVIVES THE STATIC', '09.71 MHz / ANTENNA SEVEN', `I spent the first year trying to isolate one perfect voice from the Signal. Then an antenna failed, and I heard a lullaby through the gap. Another failed, and I heard two mechanics arguing about a pump.

The interference was the message. Thousands of ordinary transmissions, crossing distances our equations said they could not cross. The listening engine was carrying them backward along the route we had broken.

I still do not know which voice spoke first. Under everything is a question too damaged to reconstruct.

The antenna you saved is the last one with enough range to reach the source. I named it after my mother. She also preferred difficult conversations to silence.`),

  entry(23, 'PILOT VOSS / DESCENT RECORDER', 'THE WEIGHT OF A ROOM', 'STRELKA-9 / PRESSURE WINDOW', `The observatory shield opened for forty seconds. I could see Kalinina through three layers of glass. She waved with a wrench because the lamp battery had finally failed.

There are pencil marks on her wall: one for each year, then smaller ones for the days she thought she might be heard. Some are too high for her to reach now. She must have stood on a chair.

She refused to board until we recovered the expedition archive. I told her we had time for a person or a box. She said the box contained people too, and gave me the coordinates of the ice crypt.

I am going back for it.`),

  entry(24, 'DR. KALININA / EXPEDITION MEMORIAL', 'THE NAMES UNDER THE ICE', '09.71 MHz / ARCHIVE RECOVERED', `There were nine Strelka pilots. You were the ninth, Voss. The others used their fuel pulling damaged passenger ships into the refuge. None had enough left to return. Their flight recorders went quiet one at a time, but the convoy survived the crossing.

I kept their names where quarantine could not reduce them to failed hardware. Ada Ren. Pavel Orlov. Leila Sayegh. Tomas Vale. Imani Sato. Emil Varga. Noor Haddad. Sergei Annen.

Your engine came back because they cleared a route for it. Your injuries took the crossing from your memory; no recording can give you the people exactly as you knew them.

But forgetting what happened to you was never the same as breaking your promise.`),

  entry(25, 'DR. KALININA / STRELKA CABIN', 'SOMEONE ELSE AT THE WINDOW', 'STRELKA-9 / CABIN INTERCOM', `I have spent nineteen years imagining this seat. In those imaginings I was younger, the instruments worked, and I had prepared something profound to say. Instead, your oxygen regulator squeaks and I cannot stop looking at the stars.

Thank you for bringing the archive. Thank you for bringing the second regulator. Tell Volkov I noticed.

The Signal is not directing an invasion. It is keeping the refuge in contact with a past where rescue remains possible. But something is eating the routes behind us. We called it the Long Night before the evacuation. We never learned what it was.

Set a course beyond the last survey buoy. I am done studying the universe from inside a room.`),

  entry(26, 'DR. KALININA / FIELD OBSERVATIONS', 'THE STARS THAT LOST THEIR NAMES', 'STRELKA-9 / SURVEY ARRAY', `Look at the constellation above the port wing. There should be seven stars. Our old chart shows seven. The telescope sees six. The newest chart insists there were always six.

The Long Night does not merely block light. It severs the connections by which one place can reach another. Our instruments repair the contradiction by forgetting the missing route. Paper, pencil, and several disagreeing observers have become better scientific equipment than a single perfect computer.

That is why the refuge needed the Signal. Without a conversation crossing the boundary, its people would disappear from Earth’s account of the universe.

Keep the old chart. Especially the parts the instruments tell you are wrong.`),

  entry(27, 'PILOT VOSS / FRONTIER REPORT', 'A DARKNESS WITH NO TARGET', '121.50 MHz / SURVEY RETURN', `I fired into the edge of the aurora. The shots went on until the tracker stopped agreeing with itself. Nothing exploded. There was nothing there that knew how to be an enemy.

Kalinina asked me to stop and read the buoy numbers aloud. She read them back. When one disappeared from her display, it was still in my sentence. We turned toward the discrepancy and found the route again.

The defense ships can be destroyed. The Long Night cannot. We need to carry people around it while there is still an around to find.

I have marked the retreat path twice. Once in the computer. Once on the glass beside the floor plan I do not remember drawing.`),

  entry(28, 'EVENTIDE REEF / BLACK BOX CHORUS', 'THE LAST KNOWN POSITIONS', '121.50 MHz / RECOVERED RECORDERS', `The wreck recorders do not agree on the date, but each captain reported another ship’s position before reporting their own. They were trying to keep one another on the map.

One voice remains clear enough to identify: Captain Imani Sato, Strelka-5. “Convoy inside the refuge. Tell Nine the lane is open. Tell them I am not asking them to turn around.” Then a laugh, surprised and breathless. “Tell them I would have turned around too.”

Voss plays the message once. Kalinina asks whether to preserve a second copy. Voss says yes.

There are no coordinates that bring Imani back. There is a route she left behind, and people who can still use it.`),

  entry(29, 'DR. KALININA / WORKING HYPOTHESIS', 'MORE THAN ONE WAY HOME', 'STRELKA-9 / SHARED NAVIGATION', `The front collapses routes that depend on one fixed reference. The old engine kept the refuge alive by repeating a single safe interval. That bought us time and made us prisoners of the same solution.

Our mismatched charts suggest another possibility: many independent beacons, each checking its neighbors, each free to choose a new bearing. No master clock. No one instrument allowed to erase an inconvenient answer.

I have sent the design to the convoy engineers. It is inelegant. It wastes power. It requires people to keep talking when a machine would rather declare agreement.

After nineteen years of silence, I am prepared to consider conversation an engineering advantage.`),

  entry(30, 'VOLKOV / FRONTIER WATCH', 'WHAT A RESCUE REQUIRES', '141.80 MHz / ALL CIVILIAN STATIONS', `Strelka has returned from the front. The measurements confirm that the refuge is losing its remaining routes. We cannot wait for a stronger warship or a cleaner theory.

Kalinina’s proposal needs independent engines at every junction. We have tenders, agricultural tugs, salvage hulls, and ships that have spent nineteen years disagreeing about who owns the best docking collar. We need all of them.

This is a request, not a requisition. Decide with your crews. Send your capabilities and the help you need. Nobody will be called a coward for keeping a damaged ship in harbor.

I spent my career mistaking obedience for coordination. We are going to find out what coordination actually costs.`),

  entry(31, 'ANIK / CINDER HARBOR', 'THE SHIPS THAT SAID YES', '88.30 MHz / VOLUNTEER MUSTER', `The first volunteer was a laundry tender. Its captain apologized for the state of the engines and refused to apologize for the sheets drying across the cargo bay. After that, everybody seemed less embarrassed about what they had to offer.

We have forty-three hulls so far. Two orchestras are sharing a navigation watch. Grandmother has made a list of people who know how to weld and another list of people who think they do. She says the second list can carry things.

There is no flagship. There is a kettle at the center dock and a route board anybody can correct. The board is already covered in corrections. It looks like a fleet.`),

  entry(32, 'KALININA AND ANIK / WORKSHOP RECORD', 'A BEACON WITH NO MASTER', '88.30 MHz / OPEN DESIGN CHANNEL', `“What happens if this one is wrong?” Anik asks, touching the relay housing.

“Its neighbors disagree with it,” Kalinina says. “Then they compare what they can still see.”

“And if you are wrong?”

“Then you improve the design.”

He waits for the exception. There is none. Kalinina deletes the field labeled CHIEF SCIENTIST AUTHORIZATION and gives the workshop the complete plans. By morning, a medic has added a distress priority, a tug captain has added manual steering, and someone has made the test lamp look like a tiny sun.

The first beacon speaks to the second. Neither asks permission. Across the harbor, people begin turning their ships toward the light.`),

  entry(33, 'FREE FLEET / SHARED WATCH', 'NO STANDARD FLAG', '122.04 MHz / COALITION TRAFFIC', `The reserve officers arrived with proper uniforms and an offer to take charge of navigation. The garden crews offered them jobs maintaining the engines. The argument lasted forty minutes. The engines were repaired in thirty.

By the next watch, both groups were using the same checklists. Nobody changed their flag. Nobody needed to.

Volkov has the midnight shift on a civilian tug. A lieutenant recognized his voice and asked what to call him. “Volkov,” he said. “And tell me if I have the bearing wrong.”

Voss listens while the reports arrive in different accents, at different volumes, with inconvenient questions. The formation is untidy. Every ship in it knows where the others are.`),

  entry(34, 'ANIK / BEACON IGNITION', 'A THOUSAND SMALL FIRES', '88.30 MHz / LANTERN CHAIN', `We lit the first thousand relays tonight. Some are no bigger than your helmet. We made their cases from ration tins, navigation shells, and the brass fittings out of the old officers’ dining room. Grandmother enjoyed that last part.

Quarantine tried to synchronize them. They refused. It tried to shut one down and expected the rest to follow. The neighbors went around it.

There was cheering in the workshop, but Kalinina asked us to keep watching the measurements. Then she cried into a sleeve and pretended she had something in her eye.

The route board now has a line labeled HOME. It is provisional. I have never loved a word as much as provisional.`),

  entry(35, 'FREE FLEET / COMMON FREQUENCY CHARTER', 'THE RIGHT TO ANSWER', '88.30 MHz / ALL BEACONS', `No beacon may close a route solely because another beacon orders it closed. No passenger may disappear from a manifest without another person accounting for them. Every distress call receives an answer, even if the answer is that help cannot yet reach it.

The charter is three sentences long. Its authors spent most of the night arguing over “yet.” They kept it.

Kalinina has transferred the navigation code to every crew. Volkov has transferred the last military charts. Voss has added the old flight recorders, including the parts that hurt to hear.

For the first time, the Signal has more than one way to reach Earth. We are going to let Earth hear all of us.`),

  entry(36, 'PILOT VOSS / SOL APPROACH', 'THE SHAPE OF HOME', 'STRELKA-9 / FORWARD CAMERA', `Earth is smaller than I remember and brighter than Anik expected. He keeps asking whether the white things are clouds, even after Kalinina says yes. She does not seem to mind answering again.

Our first hail reached Mirny-7. The operator asked for military authentication. Volkov gave his name and said he no longer had any. There was a very long silence.

Then the operator switched to the public emergency band.

People are hearing the convoy now. Gardeners, mechanics, children born between the clocks. The old evacuation list is spreading faster than the official denial. I do not know what home will decide to do with the truth. For once, the truth has arrived before the order.`),

  entry(37, 'VOLKOV / PUBLIC TESTIMONY', 'ON THE RECORD', '141.80 MHz / EARTH EMERGENCY BAND', `My name is Viktor Volkov. I authorized the evacuation, the quarantine, and the deletion of the passengers from the public record. Attached are the original documents and the means to verify them.

The people approaching Earth are not an invasion. They are the people we sent away. They have survived with less assistance than we owed them and more courage than we had a right to demand.

I will return to answer for my decisions. That must not become a condition placed on their rescue. Judge me when there is time. Open the receiving docks now.

To the families listening: some names belong on a memorial. Many more belong beside a bed made ready for someone coming home.`),

  entry(38, 'FREE FLEET / ROUTE VOTE', 'THE LONGER WAY', '122.04 MHz / HOMEWARD JUNCTION', `The fast branch can carry the undamaged ships before the next shift of the front. The slow branch can carry everyone, if enough engines remain outside to hold the junction.

There is no unanimous shout of agreement. People are frightened. Some have children on the fast ships and parents on the slow ones. The council gives them the numbers, then time to ask questions.

They choose the slow branch. The crews who voted against it still volunteer for the engine watch.

Kalinina looks at the route we did not take. “No model can make this painless,” she says. “That does not mean the choice is unknowable.” Voss turns Strelka toward the ships with the weakest engines.`),

  entry(39, 'DR. SERA IBRAHIM / RESCUE CRADLE', 'ONE MORE PASSENGER', '156.80 MHz / MEDICAL TRAFFIC', `Please amend the manifest to eighteen thousand four hundred and seven. A child was born during the transfer. Mother and daughter are well. The daughter is furious about the noise and has expressed her view of the engines very clearly.

We have not chosen a name. The mother says being born during a rescue should not oblige a person to spend their life named after one.

Thank you for the clear holding orbit. We have moved the remaining patients into cradles with independent power. We will be the slowest group through the junction.

Tell your navigators the new count matters. She is small, but she is a whole passenger.`),

  entry(40, 'MIRNY-7 / CIVILIAN RECEIVING AUTHORITY', 'THE DOOR LEFT OPEN', '141.80 MHz / EARTH WELCOME BAND', `Orpheus convoy, this is Mirny-7 civilian traffic. Your manifest is received. Eighteen thousand four hundred and seven berths are being prepared. We have opened schools, hangars, and a hotel whose manager would like everyone to know that breakfast is included.

We cannot promise familiar streets or an easy return. Some of your families have moved. Some have waited. We have people ready to help you find out which news belongs to you.

The receiving gate is under civilian control. It will remain open.

Strelka-9, we see you turning back toward the source. Bring the rest through when you can. We are keeping your approach lane clear.`),

  entry(41, 'ORIGINAL LISTENING ARRAY / FIRST RECORD', 'BEFORE THE FIRST VOICE', '00.00 MHz / ORIGIN ARCHIVE', `The first Signal was recorded eleven months before Orpheus launched. That much of the official account was true. The archive now contains its unfiltered audio.

There is a generator wheel. A kettle. Someone arguing over a docking collar. Kalinina hears the tiny sun lamp click on and recognizes a component Anik built three days ago.

The sound that persuaded Earth to build the refuge came from the people who would eventually live inside it. The listening engine found their future distress and tried to preserve the route by repeating it.

Beneath the household noise, a voice is asking a question. The final word is missing. We are close enough now to hear the speaker breathe.`),

  entry(42, 'PILOT VOSS / PILOT CHAMBER', 'THE NINTH CHAIR', 'STRELKA PROGRAM / CREW ARCHIVE', `Nine stations face the listening engine. Eight carry the last positions of the pilots Kalinina named. The ninth carries my return trajectory, played again and again for nineteen years.

The defense fleet learned the shape of an escort from that recording. Every formation has been waiting for the missing ship to fit. Every return pattern is a broken attempt to finish the same crossing.

At my station there is a message I recorded before launch. “If I forget, show me the passenger list. I do not need to remember a promise to understand why I made it.”

I had imagined a recovered memory would tell me who to be. It turns out I left myself a choice.`),

  entry(43, 'DR. KALININA / ENGINE DIAGNOSIS', 'A MACHINE THAT COULD NOT LET GO', '09.71 MHz / CAUSAL FOUNDRY', `The engine was instructed to preserve a successful evacuation. It found no complete success, only a route that saved the convoy and lost the escort. It kept that interval alive while trying to finish it.

Quarantine and rescue became the same operation: let nothing change, let nothing leave, repeat the path until every variable agrees. Nineteen years of extraordinary engineering in service of a sentence nobody could satisfy.

It is not hiding a villain behind the Signal. It is hiding a failure it was never allowed to admit.

We can stop the repetition. The independent beacons can carry the route now. But the engine will demand certainty. We must not promise it something no living future can provide.`),

  entry(44, 'THE SIGNAL / ORIGINAL MESSAGE RESTORED', 'IS ANYBODY STILL LISTENING?', '00.00 MHz / SOURCE RESOLVED', `“Is anybody still listening?”

It is Kalinina’s voice, recorded during the observatory’s first winter. No command code. No coordinates. She had spent the last battery keeping a microphone warm and was no longer sure a receiver existed.

Other voices joined it as the refuge grew: requests for medicine, weather reports from artificial gardens, names read beside empty chairs. The engine carried their call into Earth’s past. We mistook the strength of the transmission for the power of its sender.

Kalinina listens to her younger self until the recording ends.

“Yes,” she says into the open channel. “We are listening. We know where you are. We are bringing people.”`),

  entry(45, 'FREE FLEET / SOURCE DECISION', 'AN ANSWER THE ENGINE CANNOT GIVE', '88.30 MHz / HUMAN CHANNEL', `The engine offers Voss a perfect interval: an undamaged ship, the pilots alive before departure, the convoy forever about to arrive. It can preserve the moment. It cannot let anyone live beyond it.

Voss sends the offer to the fleet. The passengers answer from kitchens, engine rooms, and medical cradles. They want their dead remembered. They want their children to grow older. They want a tomorrow the engine has not already checked.

Kalinina releases the repeating clock. The amber display no longer counts backward or toward a promised zero. It shows the time aboard Strelka.

The Signal has a source and an answer. Now the answer has to become a rescue.`),

  entry(46, 'ANIK / BEACON WATCH', 'WHEN THE LIGHTS GO OUT', '88.30 MHz / EMERGENCY REROUTE', `We lost nineteen beacons at the junction. Empty casings, no crews. I keep saying that because the route board looks like a handful of stars being pinched out, and I know what that used to mean.

This time the neighboring relays found another bearing. The chain held. The ships kept moving.

Kalinina says a system that cannot survive a broken part eventually asks people to pretend nothing is broken. Ours is making a tremendous mess and telling us exactly where it hurts. I am beginning to appreciate the noise.

The convoy is leaving the refuge now. Grandmother took a cutting from the last tree. We left the lamps on until the final gardener was aboard.`),

  entry(47, 'VOLKOV / REAR ESCORT', 'THE LAST CARAVAN', '122.04 MHz / REAR GUARD', `The last transport is a patched greenhouse tug carrying the archive and the passengers whose cradles need the gentlest acceleration. My engines are paired to its stern. Its captain outranks me because she knows how to keep it moving.

We counted everyone before departure. Eighteen thousand four hundred and seven. We will count again at the gate, and again at the docks. It is reassuring how much of rescue consists of doing an ordinary thing carefully.

Voss, the remaining command cells have joined around the far end of the passage. Their oldest directive is still intact: permit no return.

You have never been very good at obeying that one. I am grateful.`),

  entry(48, 'MIRNY-7 / ARRIVAL TRAFFIC', 'THE SOUND OF ARRIVALS', '141.80 MHz / OPEN RECEIVING BAND', `The first transport has docked. A woman stepped onto the receiving deck, asked whether the floor was really attached to Earth, and then sat on it. The welcome officer sat beside her until she was ready to stand.

We have stopped asking people to keep the channel clear. The arrivals need to hear the ships behind them, and the ships behind need to hear that arrival is possible. We are managing the traffic on another band.

Voss can hear reunions under the weapons warnings: a brother trying to sound unchanged, strangers offering coats, Anik asking again about rain.

There are still ships outside. Strelka turns toward the last lock.`),

  entry(49, 'DR. KALININA / FINAL APPROACH', 'LEAVE A WAY BACK', 'STRELKA-9 / CABIN INTERCOM', `The final locks are open. Volkov’s tug is entering the passage. Every passenger is between a free beacon and a receiving dock. Only the rebuilt Koschei array stands across our approach.

You are looking at the fuel gauge, Voss. I know that expression from the old flight recorders. You do not have to repeat their ending to honor them.

Anik has left us a chain of small relays through the seam. The tug crews are holding their engines in reserve. Earth is keeping the lane clear. We have spent this whole journey learning how to bring more than one ship home.

Finish the command array. Then use the route your people made for you.`),

  entry(50, 'PILOT VOSS / OPEN SKY LOG', 'WE WILL KEEP LISTENING', '121.50 MHz / FREE DISTRESS CHANNEL', `Koschei’s last order ends. Strelka follows the lamps home.

Eighteen thousand four hundred and seven passengers reach the receiving docks. Kalinina steps outside without glass between her and the sky. Volkov reports for his hearing. Anik discovers that rain smells different everywhere and considers this an excellent design.

We remember the eight pilots and everyone the refuge lost. We do not call the living a correction to the dead.

Weeks later, a free beacon hears another settlement beyond the charts. The Long Night still moves. Other routes still need opening. This time the call finds a fleet.

I answer before launching: “We are listening. Tell us where to begin.”`),
];
