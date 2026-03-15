# Technical Analysis of Quake-Style Strafe Jumping Physics

This report provides a rigorous mathematical and technical breakdown of "strafe jumping" and "air strafing," the iconic movement exploits found in the Quake engine (Id Tech) and its descendants (Source, GoldSrc, etc.). The analysis is based on the source code logic of `PM_Accelerate` and `SV_AirAccelerate` as implemented in *Quake III Arena* and *Quake 1*.

---

## 1. The Core Movement Logic: `PM_Accelerate`

In the Quake engine, every frame the game updates the player's velocity based on their keyboard and mouse inputs. The fundamental function responsible for this is `PM_Accelerate`. 

### The Algorithm
The logic follows these steps:
1. **Wish Velocity ($\vec{W}$):** The engine calculates a vector based on the player's movement keys (W, A, S, D) and their current camera orientation.
2. **Wish Direction ($\hat{w}$):** This is the normalized version of $\vec{W}$ (a unit vector).
3. **Current Speed ($v_{cur}$):** This is calculated as the **dot product** of the player's current velocity ($\vec{v}$) and the wish direction ($\hat{w}$).
   $$v_{cur} = \vec{v} \cdot \hat{w}$$
4. **Add Speed ($v_{add}$):** The game determines how much speed can still be added before hitting the "wish speed" ($v_{wish}$) cap.
   $$v_{add} = v_{wish} - v_{cur}$$
5. **Clamping:** If $v_{add} \le 0$, the function exits (no acceleration). Otherwise, the acceleration is capped by a maximum acceleration constant ($A$) and frame time ($\Delta t$).
   $$a = \min(v_{add}, A \cdot v_{wish} \cdot \Delta t)$$
6. **Velocity Update:** The new velocity is:
   $$\vec{v}_{new} = \vec{v} + a \cdot \hat{w}$$

---

## 2. The Mathematical Loophole

The "exploit" arises because $v_{cur}$ is not the actual magnitude of the velocity vector ($|\vec{v}|$), but rather its **scalar projection** onto the wish direction.

### The Condition for Speed Gain
For the player to gain speed, the magnitude of the new velocity must be greater than the old: $|\vec{v}_{new}| > |\vec{v}|$.
Using the Law of Cosines, where $\theta$ is the angle between $\vec{v}$ and $\hat{w}$:
$$|\vec{v}_{new}|^2 = |\vec{v}|^2 + a^2 + 2|\vec{v}|a\cos(\theta)$$

If the player moves strictly in the direction they are looking ($\theta = 0$), $v_{cur}$ quickly reaches $v_{wish}$, making $v_{add} = 0$ and stopping acceleration. However, if the player angles their wish direction such that the projection $v_{cur}$ remains below $v_{wish}$, they can continue to add a vector $a\hat{w}$ to their velocity indefinitely.

---

## 3. Deriving the Optimal Angle

To maximize speed gain, a player must find the "sweet spot": the angle $\theta$ where they add the maximum possible acceleration without being "clipped" by the speed cap.

### The "Dead Zone"
The "Dead Zone" occurs when $\vec{v} \cdot \hat{w} \ge v_{wish}$. In this region, no acceleration occurs. To stay outside this zone while traveling at high speeds, the angle $\theta$ must increase toward 90°.

### The Optimal Angle Formula
The optimal angle $\theta_{opt}$ is reached when the projection is just below the limit:
$$\cos(\theta_{opt}) = \frac{v_{wish} - \epsilon}{|\vec{v}|}$$
As the player's speed $|\vec{v}|$ increases, $\cos(\theta_{opt})$ approaches 0, meaning the optimal angle $\theta$ approaches 90°. 

---

## 4. Engine Variations: Quake 1 vs. Quake 3

### Quake 1 & Source (Air Strafing)
In *Quake 1* and the *Source Engine*, the air acceleration code (`SV_AirAccelerate`) typically uses a very low $v_{wish}$ (often 30 units/s). 
* **The Result:** Because $v_{wish}$ is so small, the "Dead Zone" covers almost the entire forward hemisphere. To accelerate, the player **must** look almost 90° away from their movement direction. This allows for the extreme "curving" seen in *Counter-Strike* or *Team Fortress 2*.

### Quake 3 Arena (Strafe Jumping)
In *Quake 3*, the $v_{wish}$ is not clamped to 30 in the same way, but the acceleration constant $A$ is much smaller.
* **The Result:** The optimal angle is much narrower (often around 40-45° initially). This leads to "strafe jumping," where players alternate flicking their mouse left and right while holding the corresponding strafe keys.

---

## 5. Summary of Key Variables

| Variable | Description | Common Quake 3 Value |
| :--- | :--- | :--- |
| **`v_wish`** | The target speed cap for the projection. | 320 units/s |
| **`accel`** | The acceleration multiplier. | 10.0 (Ground) / 1.0 (Air) |
| **`theta`** | Angle between velocity and wish direction. | Variable (Optimal $\approx \arccos(v_{wish}/v)$) |
| **`v_add`** | The "gap" available for more speed. | `max(0, v_wish - v * cos(theta))` |

---

> **Note:** This movement logic is found in the `bg_pmove.c` file of the Quake III source code within the `PM_Accelerate` function.