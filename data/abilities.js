// Custom Kalysian abilities. Details shown on each ability page. Add or edit entries by hand.
window.KALYSIDEX = window.KALYSIDEX || {};
window.KALYSIDEX.abilities = {
  "Bug Burp": {"frequency":"Scene - Free Action","effect":"Connection - Belch. The user may activate Big Burp when using Belch to increase the DB by 1 per digestion buff the user has stored."},
  "Crystallization": {"frequency":"Scene - Free Action","trigger":"The user enters the field","effect":"If this pokemon has a gem at the beginning of the fight, it can break it up to power up every stat (+1 CS to all stats)"},
  "Desperate Charge": {"frequency":"Scene x2 - Free Action","trigger":"The user uses a Physical or Special move.","effect":"You may use the move with the Priority Keyword but it also gains the Exhaust Keyword."},
  "Element Sync": {"frequency":"Static","effect":"If this Pokemon has an elemental gem as a Held Item, it will get the element of that stone as a secondary type. If the elemental gem is broken by Crystallization, the Elemental type will stay for the remaining of the scene"},
  "Ethereal Strike": {"frequency":"Static","effect":"The User Treats all Tail, Punch, and Kick Moves as if they were Range 4, 1 Target and Special Damaging."},
  "Fall Out": {"frequency":"Static","effect":"Falling asleep poisons the opponents within a Burst 2."},
  "Gem Synchrony": {"frequency":"Static","trigger":"The user uses Power Gem","effect":"Connection - Power Gem. Power Gem deals elemental damage equal to the secondary type gains by Element Sync.","bonus":"The user may choose between Physical or Special."},
  "Half Life": {"frequency":"Static","effect":"Each time the user falls asleep; raise the user’s attack by +1 CS."},
  "Immortal Virtue": {"frequency":"Daily - Free Action","trigger":"User is hit by a Damaging Move.","effect":"Connection - Healing Wish. The user can use Healing Wish as an Interrupt. After the user faints from Healing Wish they do not take damage from the triggering hit."},
  "Mortal Sin": {"frequency":"Daily - Free Action","effect":"Connection - Guillotine. Whenever the user uses Guillotine, the user may activate this Ability to change the calculated effect to be: X is equal to 50 + The User's Level - The Target's Level."},
  "Oil Spill": {"frequency":"Static","effect":"The user resists Water-Type attacks two steps further, but resists Fire-Type attacks one step less. Extra: The user gains +2 Evasion against damaging Melee attacks. Defensive."},
  "Rock Affinity": {"frequency":"Static","effect":"Connection - Granite Gaze. When the user uses Granite Gaze, on 19+ all targets Flinch. Additionally the Pokemon has stab with this move."},
  "Scales of Balance": {"frequency":"Static","effect":"Connection- Simple Beam.. The target's ONLY ability becomes Simple."},
  "Space-Out": {"frequency":"Swift Action - Scene","effect":"The user is Vulnerable and has Total Blindness for 1 full round. Additionally, Gaveweko gains +1 CS in two stats of its choice."},
  "Speed of Sound": {"frequency":"Static","effect":"Speed of Sound allows the users speed evasion to reach +9 through stats, and up to +12 through features and moves. Defensive."},
  "Stoneskin": {"frequency":"Static","trigger":"The use is hit by a physical move.","effect":"Pokemon is granted Damage Reduction 5."},
  "Zen Rolled": {"frequency":"Scene - Swift Action","effect":"The user changes into Zen Rolled forme for the rest of the Scene, and may use the Moves “U-Turn” and “Steamroller” as if they were on its Move List."}
};
