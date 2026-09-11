// E:\study\techfix\techfix-app\src\screens\LoginChoiceScreen.js
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../theme/colors';

// Defensive fallbacks so a stale colors.js file can never crash the native
// gradient view (an undefined color there is what caused the earlier
// "null cannot be cast to Double" Android crash).
const C = {
  background: '#0B0B0D',
  cardDark: '#1C1C1F',
  cardDarkTop: '#232326',
  cardBorder: 'rgba(244,208,63,0.18)',
  glowStrong: 'rgba(244,208,63,0.55)',
  glowTransparent: 'rgba(244,208,63,0)',
  buttonGradientStart: '#FBE68A',
  buttonGradientEnd: '#F0C929',
  boltCoreLight: '#FFF6D6',
  boltCoreMid: '#F4D03F',
  boltCoreDeep: '#C4841A',
  boltShadow: '#8A5A0E',
  ...COLORS,
};


const { width } = Dimensions.get('window');
const ORBIT_SIZE = Math.min(width * 0.85, 350);
const CORE_SIZE = ORBIT_SIZE * 0.6;
// Add fixed bolt dimensions (keeps the 100x120 viewBox aspect ratio correct)
const BOLT_W = CORE_SIZE * 0.5;
const BOLT_H = BOLT_W * 1.2;

const ORBIT_ICONS = [
  'account-group',
  'text-box-outline',
  'calendar-month-outline',
  'cog-outline',
  'chart-bar',
  'checkbox-marked-outline',
];

// --- Precomputed circular-motion keyframes (icon orbit, unchanged) -------
const STEPS = 32;
const CIRCLE_INPUT = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);

function buildOrbitKeyframes(radiusX, radiusY, phase) {
  const x = [];
  const y = [];
  const scale = [];
  const opacity = [];
  CIRCLE_INPUT.forEach((t) => {
    const theta = 2 * Math.PI * t + phase;
    x.push(radiusX * Math.cos(theta));
    y.push(radiusY * Math.sin(theta));
    const depth = (Math.sin(theta) + 1) / 2;
    scale.push(0.68 + depth * 0.45);
    opacity.push(0.5 + depth * 0.5);
  });
  return { x, y, scale, opacity };
}

function OrbitIcon({ orbitAngle, iconName, phase, radiusX, radiusY }) {
  const { x, y, scale, opacity } = useMemo(
    () => buildOrbitKeyframes(radiusX, radiusY, phase),
    [radiusX, radiusY, phase]
  );
  const translateX = orbitAngle.interpolate({ inputRange: CIRCLE_INPUT, outputRange: x });
  const translateY = orbitAngle.interpolate({ inputRange: CIRCLE_INPUT, outputRange: y });
  const iconScale = orbitAngle.interpolate({ inputRange: CIRCLE_INPUT, outputRange: scale });
  const iconOpacity = orbitAngle.interpolate({ inputRange: CIRCLE_INPUT, outputRange: opacity });

  return (
    <Animated.View
      style={[
        styles.iconTile,
        { opacity: iconOpacity, transform: [{ translateX }, { translateY }, { scale: iconScale }] },
      ]}
    >
      <LinearGradient colors={[C.cardDarkTop, C.cardDark]} style={styles.iconTileGradient}>
        <MaterialCommunityIcons name={iconName} size={24} color={C.primary} />
      </LinearGradient>
    </Animated.View>
  );
}

function AnimatedButton({ style, onPress, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity activeOpacity={0.9} onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} style={style}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- Center artwork: a bolt that behaves like an actual lightning strike --
// It "draws" in from the top tip downward (a clip-path rectangle grows to
// reveal it), flickers a couple of times like a real strike, holds, then
// fades and strikes again on a loop. No rings, no static glow halo.
function LightningBolt({ boltReveal, boltFlicker }) {
  const maskTranslateY = boltReveal.interpolate({ inputRange: [0, 1], outputRange: [0, BOLT_H + 6] });

  return (
    <View style={[styles.boltShadowWrap, { width: BOLT_W, height: BOLT_H }]}>
      <Animated.View style={{ opacity: boltFlicker }}>
        <Svg width={BOLT_W} height={BOLT_H} viewBox="0 0 100 120">
          <Defs>
            <SvgLinearGradient id="boltGrad" x1="0.1" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={C.boltCoreLight} />
              <Stop offset="0.45" stopColor={C.boltCoreMid} />
              <Stop offset="1" stopColor={C.boltCoreDeep} />
            </SvgLinearGradient>
          </Defs>
          <Path d="M68,6 L18,64 H44 L30,114 L96,44 H58 L68,6 Z" fill={C.boltShadow} opacity={0.45} transform="translate(4,6)" />
          <Path d="M68,6 L18,64 H44 L30,114 L96,44 H58 L68,6 Z" fill="url(#boltGrad)" stroke={C.boltCoreLight} strokeWidth={1.4} strokeOpacity={0.9} strokeLinejoin="round" />
          <Path d="M62,14 L30,58 H40 L62,14 Z" fill={C.white} opacity={0.32} />
        </Svg>
      </Animated.View>

      {/* Slides down and off, revealing the bolt top-to-bottom as it moves */}
      <Animated.View
        pointerEvents="none"
        style={[styles.boltMask, { width: BOLT_W, height: BOLT_H, transform: [{ translateY: maskTranslateY }] }]}
      />
    </View>
  );
}

export default function LoginChoiceScreen({ navigation }) {
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const orbitFade = useRef(new Animated.Value(0)).current;
  const orbitScale = useRef(new Animated.Value(0.85)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const buttonsSlide = useRef(new Animated.Value(24)).current;
  const footerFade = useRef(new Animated.Value(0)).current;

  const orbitAngle = useRef(new Animated.Value(0)).current;
  const boltReveal = useRef(new Animated.Value(0)).current;   // 0 = hidden, 1 = fully struck
  const boltFlicker = useRef(new Animated.Value(1)).current;  // opacity flicker once struck

  useEffect(() => {
    Animated.stagger(140, [
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(orbitFade, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.spring(orbitScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonsSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(footerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.timing(orbitAngle, { toValue: 1, duration: 9000, useNativeDriver: true })).start();

    // Lightning strike cycle: strike down from the tip, flicker, hold, fade, repeat.
    const strikeCycle = Animated.loop(
      Animated.sequence([
        Animated.timing(boltReveal, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(boltFlicker, { toValue: 0.25, duration: 50, useNativeDriver: true }),
          Animated.timing(boltFlicker, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(boltFlicker, { toValue: 0.4, duration: 70, useNativeDriver: true }),
          Animated.timing(boltFlicker, { toValue: 1, duration: 90, useNativeDriver: true }),
        ]),
        Animated.delay(2600),
        Animated.timing(boltReveal, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    strikeCycle.start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[C.glowStrong, C.glowTransparent]}
        style={styles.glowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.4, y: 0.6 }}
      />
      <LinearGradient
        colors={[C.glowStrong, C.glowTransparent]}
        style={styles.glowBottomLeft}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.6, y: 0.4 }}
      />

      <Animated.View style={[styles.logoContainer, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        <View style={styles.logoRow}>
          <Text style={styles.logoWhite}>TEX </Text>
          <Text style={styles.logoYellow}>FIX</Text>
        </View>
        <Text style={styles.subtitle}>SMART OPERATIONS</Text>
        <View style={styles.underline} />
      </Animated.View>

      <Animated.View style={[styles.orbitWrapper, { opacity: orbitFade, transform: [{ scale: orbitScale }] }]}>
        <View style={[styles.core, { width: CORE_SIZE, height: CORE_SIZE }]}>
          <LightningBolt boltReveal={boltReveal} boltFlicker={boltFlicker} />
        </View>

        {ORBIT_ICONS.map((name, i) => (
          <OrbitIcon
            key={name}
            orbitAngle={orbitAngle}
            iconName={name}
            phase={(i / ORBIT_ICONS.length) * Math.PI * 2}
            radiusX={ORBIT_SIZE * 0.42}
            radiusY={ORBIT_SIZE * 0.24}
          />
        ))}
      </Animated.View>

      <Animated.View style={[styles.buttonsContainer, { opacity: buttonsFade, transform: [{ translateY: buttonsSlide }] }]}>
        <AnimatedButton style={styles.loginButtonShadow} onPress={() => navigation.navigate('TechnicianLogin')}>
          <LinearGradient
            colors={[C.buttonGradientStart, C.buttonGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loginButton}
          >
            <MaterialIcons name="person" size={24} color={C.dark} />
            <Text style={styles.buttonText}>Technician Login</Text>
            <MaterialIcons name="chevron-right" size={22} color={C.dark} />
          </LinearGradient>
        </AnimatedButton>

        <AnimatedButton style={[styles.loginButton, styles.adminButton]} onPress={() => navigation.navigate('AdminLogin')}>
          <MaterialIcons name="shield" size={22} color={C.white} />
          <Text style={[styles.buttonText, styles.adminButtonText]}>Admin Login</Text>
          <MaterialIcons name="chevron-right" size={22} color={C.white} />
        </AnimatedButton>

        <Animated.View style={[styles.footer, { opacity: footerFade }]}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>Developed by  ASA LABS</Text>
          <View style={styles.footerLine} />
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, overflow: 'hidden' },
  glowTopRight: { position: 'absolute', top: -80, right: -80, width: 220, height: 220, borderRadius: 110 },
  glowBottomLeft: { position: 'absolute', bottom: -80, left: -80, width: 220, height: 220, borderRadius: 110 },

  logoContainer: { alignItems: 'center', paddingTop: 40 },
  logoRow: { flexDirection: 'row' },
  logoWhite: { fontSize: 44, fontWeight: 'bold', color: C.white, letterSpacing: 2 },
  logoYellow: { fontSize: 44, fontWeight: 'bold', color: C.primary, letterSpacing: 2 },
  subtitle: { fontSize: 10, color: C.lightGray, letterSpacing: 3, marginTop: 6, fontWeight: '600' },
  underline: { width: 40, height: 2, backgroundColor: C.primary, marginTop: 12, borderRadius: 1 },

  orbitWrapper: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  core: { justifyContent: 'center', alignItems: 'center' },
  boltShadowWrap: {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 6,
},
boltMask: { position: 'absolute', top: 0, left: 0, backgroundColor: C.background },

  iconTile: { position: 'absolute', width: 56, height: 56 },
  iconTileGradient: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonsContainer: { paddingHorizontal: 24, paddingBottom: 24, marginTop: 'auto' },
  loginButtonShadow: {
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  loginButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.lightGray,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: C.dark, marginHorizontal: 12 },
  adminButtonText: { color: C.white },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  footerLine: { width: 30, height: 1, backgroundColor: C.lightGray, opacity: 0.4 },
  footerText: { color: C.lightGray, fontSize: 12, letterSpacing: 1, marginHorizontal: 10, fontWeight: '600' },
});