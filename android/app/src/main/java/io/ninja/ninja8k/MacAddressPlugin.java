package io.ninja.ninja8k;

import android.content.Context;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

/**
 * ============================================================================
 * NINJA 8K - MAC Address Plugin
 * ============================================================================
 * 
 * Récupère la vraie adresse MAC WiFi hardware de l'appareil.
 * Fonctionne sur Android 6 à Android 15.
 * 
 * Méthodes utilisées (dans l'ordre de priorité):
 * 1. NetworkInterface (le plus fiable)
 * 2. Lecture directe de /sys/class/net/wlan0/address
 * 3. WifiManager (deprecated mais fonctionne sur vieux appareils)
 * 4. Commande shell cat (fallback)
 * 
 * ============================================================================
 */
@CapacitorPlugin(name = "MacAddressPlugin")
public class MacAddressPlugin extends Plugin {
    
    private static final String TAG = "MacAddressPlugin";
    
    @PluginMethod
    public void getMacAddress(PluginCall call) {
        try {
            String mac = null;
            
            // Méthode 1: NetworkInterface (recommandée pour Android 6+)
            mac = getMacFromNetworkInterface();
            if (isValidMac(mac)) {
                Log.d(TAG, "MAC from NetworkInterface: " + mac);
                returnMac(call, mac, "network_interface");
                return;
            }
            
            // Méthode 2: Lecture fichier système
            mac = getMacFromFile();
            if (isValidMac(mac)) {
                Log.d(TAG, "MAC from file: " + mac);
                returnMac(call, mac, "sys_file");
                return;
            }
            
            // Méthode 3: WifiManager (deprecated mais fonctionne)
            mac = getMacFromWifiManager();
            if (isValidMac(mac)) {
                Log.d(TAG, "MAC from WifiManager: " + mac);
                returnMac(call, mac, "wifi_manager");
                return;
            }
            
            // Méthode 4: Shell command
            mac = getMacFromShell();
            if (isValidMac(mac)) {
                Log.d(TAG, "MAC from shell: " + mac);
                returnMac(call, mac, "shell");
                return;
            }
            
            // Aucune méthode n'a fonctionné
            call.reject("Unable to retrieve MAC address");
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting MAC address", e);
            call.reject("Error: " + e.getMessage());
        }
    }
    
    /**
     * Méthode 1: NetworkInterface - La plus fiable
     */
    private String getMacFromNetworkInterface() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            
            for (NetworkInterface intf : interfaces) {
                // Chercher wlan0 en priorité
                if (!intf.getName().equalsIgnoreCase("wlan0")) continue;
                
                byte[] mac = intf.getHardwareAddress();
                if (mac == null || mac.length == 0) continue;
                
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < mac.length; i++) {
                    sb.append(String.format("%02X%s", mac[i], (i < mac.length - 1) ? ":" : ""));
                }
                return sb.toString();
            }
            
            // Si wlan0 pas trouvé, chercher n'importe quelle interface WiFi
            for (NetworkInterface intf : interfaces) {
                if (intf.isLoopback()) continue;
                if (intf.getName().startsWith("dummy")) continue;
                if (intf.getName().startsWith("rmnet")) continue; // Interface mobile
                
                byte[] mac = intf.getHardwareAddress();
                if (mac == null || mac.length == 0) continue;
                
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < mac.length; i++) {
                    sb.append(String.format("%02X%s", mac[i], (i < mac.length - 1) ? ":" : ""));
                }
                
                String result = sb.toString();
                // Éviter les MAC génériques
                if (!result.equals("02:00:00:00:00:00")) {
                    return result;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "NetworkInterface method failed", e);
        }
        return null;
    }
    
    /**
     * Méthode 2: Lecture directe du fichier système
     */
    private String getMacFromFile() {
        String[] paths = {
            "/sys/class/net/wlan0/address",
            "/sys/class/net/eth0/address",
            "/sys/class/net/wifi/address"
        };
        
        for (String path : paths) {
            try {
                BufferedReader reader = new BufferedReader(new FileReader(path));
                String mac = reader.readLine();
                reader.close();
                
                if (mac != null) {
                    return mac.trim().toUpperCase();
                }
            } catch (Exception e) {
                // Fichier non accessible, essayer le suivant
            }
        }
        return null;
    }
    
    /**
     * Méthode 3: WifiManager (deprecated mais fonctionne sur vieux appareils)
     */
    @SuppressWarnings("deprecation")
    private String getMacFromWifiManager() {
        try {
            WifiManager wifiManager = (WifiManager) getContext()
                .getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            
            if (wifiManager == null) return null;
            
            WifiInfo wifiInfo = wifiManager.getConnectionInfo();
            if (wifiInfo == null) return null;
            
            String mac = wifiInfo.getMacAddress();
            if (mac != null && !mac.equals("02:00:00:00:00:00")) {
                return mac.toUpperCase();
            }
        } catch (Exception e) {
            Log.e(TAG, "WifiManager method failed", e);
        }
        return null;
    }
    
    /**
     * Méthode 4: Commande shell (fallback)
     */
    private String getMacFromShell() {
        String[] commands = {
            "cat /sys/class/net/wlan0/address",
            "getprop wifi.interface",
            "ip link show wlan0"
        };
        
        for (String cmd : commands) {
            try {
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream())
                );
                
                String line = reader.readLine();
                reader.close();
                process.destroy();
                
                if (line != null && line.contains(":")) {
                    // Extraire l'adresse MAC si présente
                    String mac = extractMac(line);
                    if (mac != null) {
                        return mac.toUpperCase();
                    }
                }
            } catch (Exception e) {
                // Commande échouée, essayer la suivante
            }
        }
        return null;
    }
    
    /**
     * Extrait une adresse MAC d'une chaîne
     */
    private String extractMac(String input) {
        // Pattern MAC: XX:XX:XX:XX:XX:XX
        String pattern = "([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(input);
        
        if (m.find()) {
            return m.group().replace("-", ":").toUpperCase();
        }
        return null;
    }
    
    /**
     * Vérifie si l'adresse MAC est valide
     */
    private boolean isValidMac(String mac) {
        if (mac == null || mac.isEmpty()) return false;
        if (mac.equals("02:00:00:00:00:00")) return false; // MAC générique Android
        if (mac.equals("00:00:00:00:00:00")) return false;
        if (!mac.matches("([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})")) return false;
        return true;
    }
    
    /**
     * Retourne la MAC address au JavaScript
     */
    private void returnMac(PluginCall call, String mac, String method) {
        JSObject result = new JSObject();
        result.put("mac", mac);
        result.put("method", method);
        result.put("formatted", formatMacForDisplay(mac));
        call.resolve(result);
    }
    
    /**
     * Formate la MAC pour affichage
     */
    private String formatMacForDisplay(String mac) {
        return mac.toUpperCase().replace("-", ":");
    }
}
