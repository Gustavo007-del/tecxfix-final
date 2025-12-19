// E:\study\techfix\techfix-app\src\screens\CreateCourierScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    Alert, ActivityIndicator, TextInput, FlatList, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client, { API_ENDPOINTS } from '../api/client';
import { COLORS } from '../theme/colors';

export default function CreateCourierScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { userToken } = useContext(AuthContext);
    
    // State management
    const [step, setStep] = useState(1); // 1: Select Techs, 2: Select Items, 3: Enter Qty, 4: Review
    const [selectedTechs, setSelectedTechs] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [availableTechs, setAvailableTechs] = useState([]);
    const [availableStock, setAvailableStock] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTechModal, setShowTechModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [notes, setNotes] = useState('');
    
    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, []);
    
    const fetchData = async () => {
    setLoading(true);
    try {
        // Fetch technicians
        try {
            const techResponse = await client.get(API_ENDPOINTS.TECHNICIANS_FOR_COURIER);
            console.log('=== RAW TECHNICIAN RESPONSE ===');
            console.log(JSON.stringify(techResponse.data, null, 2));
            console.log('================================');
            
            const techData = techResponse.data.data || techResponse.data;
            
            // Filter out admin users as safety
            const filteredTechs = Array.isArray(techData) 
                ? techData.filter(t => t.id !== 1) // Exclude admin ID 1
                : [];
            
            console.log('=== FILTERED TECHNICIANS ===');
            filteredTechs.forEach(t => {
                console.log(`ID: ${t.id}, Username: ${t.username}`);
            });
            console.log('============================');
            
            setAvailableTechs(filteredTechs);
        } catch (techError) {
            console.warn('Failed to fetch technicians:', techError);
            setAvailableTechs([]);
        }
        
        // Fetch company stock
        try {
            const stockResponse = await client.get(API_ENDPOINTS.COMPANY_STOCK);
            const stockData = stockResponse.data.data || stockResponse.data;
            setAvailableStock(Array.isArray(stockData) ? stockData : []);
        } catch (stockError) {
            console.error('Error fetching stock:', stockError);
            Alert.alert('Error', 'Failed to load stock items');
            setAvailableStock([]);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load initial data');
    } finally {
        setLoading(false);
    }
};

    
    // Toggle technician selection
    const toggleTechSelection = (techId) => {
        setSelectedTechs(prev =>
            prev.includes(techId)
                ? prev.filter(id => id !== techId)
                : [...prev, techId]
        );
    };
    
    // State for quantity input
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState('1');
    
    // Add item to selection with quantity
    const addItem = (item) => {
        setSelectedItem(item);
        setQuantity('1');
    };
    
    // Confirm adding item with quantity
    const confirmAddItem = () => {
        const qty = parseInt(quantity, 10) || 1;
        if (qty <= 0) {
            Alert.alert('Error', 'Quantity must be at least 1');
            return;
        }
        
        if (selectedItem) {
            setSelectedItems(prev => [
                ...prev, 
                { 
                    ...selectedItem, 
                    qty: qty,
                    mrp: parseFloat(selectedItem.mrp) || 0
                }
            ]);
            setSelectedItem(null);
            setShowItemModal(false);
        }
    };
    
    // Update item quantity
    const updateItemQty = (index, qty) => {
        const newItems = [...selectedItems];
        if (qty > 0 && qty <= newItems[index].qty + (availableStock.find(
            s => s.spare_id === newItems[index].spare_id
        )?.qty || 0)) {
            newItems[index].qty = qty;
            setSelectedItems(newItems);
        }
    };
    
    // Remove item from selection
    const removeItem = (index) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index));
    };
    
    const handleCreateCourier = async () => {
    if (selectedTechs.length === 0 || selectedItems.length === 0) {
        Alert.alert('Error', 'Please select technicians and items');
        return;
    }
    
    setSubmitting(true);
    try {
        // Format items to match backend expectations
        const formattedItems = selectedItems.map(item => ({
            spare_id: item.spare_id,
            qty: parseInt(item.qty, 10) || 1,
            name: item.name,
            mrp: parseFloat(item.mrp) || 0,
            brand: item.brand || '',
            hsn: item.hsn || ''
        }));

        const payload = {
            technician_ids: selectedTechs,
            items: formattedItems,
            notes: notes,
        };

        // DEBUG: Log the payload
        console.log('=== CREATE COURIER PAYLOAD ===');
        console.log('Technician IDs:', payload.technician_ids);
        console.log('Items:', JSON.stringify(payload.items, null, 2));
        console.log('Notes:', payload.notes);
        console.log('==============================');

        const response = await client.post(API_ENDPOINTS.COURIER_CREATE, payload);
        
        console.log('SUCCESS:', response.data);
        
        const courierId = response.data.data?.id;
        
        Alert.alert('Success', 'Courier created successfully!', [
            {
                text: 'View Courier',
                onPress: () => {
                    if (courierId) {
                        navigation.replace('CourierView', { courierId });
                    } else {
                        navigation.goBack();
                    }
                },
            },
            {
                text: 'Create Another',
                onPress: () => {
                    setSelectedTechs([]);
                    setSelectedItems([]);
                    setNotes('');
                    setStep(1);
                },
            },
        ]);
    } catch (error) {
        console.error('=== ERROR CREATING COURIER ===');
        console.error('Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
        console.error('===============================');
        
        const errorMsg = error.response?.data?.error || 
                       JSON.stringify(error.response?.data) ||
                       error.message || 
                       'Failed to create courier. Please try again.';
        Alert.alert('Error', errorMsg);
    } finally {
        setSubmitting(false);
    }
};
    const resetForm = () => {
        setSelectedTechs([]);
        setSelectedItems([]);
        setNotes('');
        setStep(1);
    };
    
    // Render Step 1: Select Technicians
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 1: Select Technicians</Text>
            <Text style={styles.stepSubtitle}>
                Who should receive these items?
            </Text>
            
            <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowTechModal(true)}
            >
                <MaterialIcons name="person-add" size={20} color={COLORS.white} />
                <Text style={styles.selectButtonText}>Add Technician</Text>
            </TouchableOpacity>
            
            {selectedTechs.length > 0 && (
                <View style={styles.selectedContainer}>
                    <Text style={styles.selectedLabel}>Selected Technicians:</Text>
                    {selectedTechs.map((techId, idx) => {
                        const tech = availableTechs.find(t => t.id === techId);
                        return (
                            <View key={idx} style={styles.selectedItem}>
                                <Text style={styles.selectedItemText}>
                                    {tech?.first_name || tech?.username}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => toggleTechSelection(techId)}
                                >
                                    <MaterialIcons name="close" size={18} color={COLORS.red} />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
    
    // Render Step 2: Select Items
    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 2: Select Items</Text>
            <Text style={styles.stepSubtitle}>
                What items to send? ({selectedItems.length} selected)
            </Text>
            
            <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowItemModal(true)}
            >
                <MaterialIcons name="add-box" size={20} color={COLORS.white} />
                <Text style={styles.selectButtonText}>Add Item</Text>
            </TouchableOpacity>
            
            {selectedItems.length > 0 && (
                <View style={styles.selectedContainer}>
                    <Text style={styles.selectedLabel}>Selected Items:</Text>
                    {selectedItems.map((item, idx) => (
                        <View key={idx} style={styles.selectedItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.selectedItemText}>{item.name}</Text>
                                <Text style={styles.selectedItemSubtext}>
                                    Code: {item.spare_id} | Qty: {item.qty}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => removeItem(idx)}>
                                <MaterialIcons name="delete" size={18} color={COLORS.red} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
    
    // Render Step 3: Review & Notes
    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 3: Review & Add Notes</Text>
            
            <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Technicians:</Text>
                {selectedTechs.map((techId, idx) => {
                    const tech = availableTechs.find(t => t.id === techId);
                    return (
                        <Text key={idx} style={styles.reviewItem}>
                            • {tech?.first_name || tech?.username}
                        </Text>
                    );
                })}
            </View>
            
            <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Items:</Text>
                {selectedItems.map((item, idx) => (
                    <View key={idx}>
                        <Text style={styles.reviewItem}>
                            • {item.name} (x{item.qty}) - ₹{item.mrp?.toFixed(2)}
                        </Text>
                    </View>
                ))}
                <View style={styles.divider} />
                <Text style={styles.reviewTotal}>
                    Total: ₹{selectedItems.reduce((sum, item) => sum + (item.qty * (item.mrp || 0)), 0).toFixed(2)}
                </Text>
            </View>
            
            <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Add Notes (Optional):</Text>
                <TextInput
                    style={styles.notesInput}
                    placeholder="Any additional notes..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholderTextColor={COLORS.gray}
                />
            </View>
        </View>
    );
    
    // Render Technician Selection Modal
    const renderTechModal = () => (
    <Modal
        visible={showTechModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTechModal(false)}
    >
        <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Technician</Text>
                    <TouchableOpacity onPress={() => setShowTechModal(false)}>
                        <MaterialIcons name="close" size={24} color={COLORS.dark} />
                    </TouchableOpacity>
                </View>
                
                <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search technician..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.gray}
                />
                
                <FlatList
                    data={availableTechs.filter(t =>
                        (t.first_name && t.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (t.username && t.username.toLowerCase().includes(searchQuery.toLowerCase()))
                    )}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.modalItem,
                                selectedTechs.includes(item.id) && styles.modalItemSelected
                            ]}
                            onPress={() => {
                                console.log(`Selected: ID=${item.id}, Username=${item.username}`);
                                toggleTechSelection(item.id);
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalItemText}>
                                    {item.first_name || item.username}
                                </Text>
                                <Text style={styles.modalItemSubtext}>
                                    {item.username}
                                </Text>
                            </View>
                            {selectedTechs.includes(item.id) && (
                                <MaterialIcons name="check" size={20} color={COLORS.success} />
                            )}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No technicians found</Text>
                        </View>
                    }
                />
                
                <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowTechModal(false)}
                >
                    <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>
);
    
    // Render Item Selection Modal
    const renderItemModal = () => (
        <Modal
            visible={showItemModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowItemModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {selectedItem ? 'Select Quantity' : 'Select Item'}
                        </Text>
                        <TouchableOpacity onPress={() => {
                            if (selectedItem) {
                                setSelectedItem(null);
                            } else {
                                setShowItemModal(false);
                            }
                        }}>
                            <MaterialIcons name={selectedItem ? "arrow-back" : "close"} size={24} color={COLORS.dark} />
                        </TouchableOpacity>
                    </View>
                    
                    {selectedItem ? (
                        <View style={styles.quantityContainer}>
                            <Text style={styles.selectedItemName}>{selectedItem.name}</Text>
                            <Text style={styles.availableText}>
                                Available: {selectedItem.qty} | ₹{selectedItem.mrp?.toFixed(2)} each
                            </Text>
                            
                            <View style={styles.quantitySelector}>
                                <TouchableOpacity 
                                    style={styles.quantityButton}
                                    onPress={() => {
                                        const newQty = Math.max(1, parseInt(quantity, 10) - 1);
                                        setQuantity(newQty.toString());
                                    }}
                                >
                                    <MaterialIcons name="remove" size={24} color={COLORS.white} />
                                </TouchableOpacity>
                                
                                <TextInput
                                    style={styles.quantityInput}
                                    value={quantity}
                                    onChangeText={(text) => {
                                        // Only allow numbers
                                        if (text === '' || /^\d+$/.test(text)) {
                                            setQuantity(text);
                                        }
                                    }}
                                    keyboardType="numeric"
                                    maxLength={3}
                                />
                                
                                <TouchableOpacity 
                                    style={styles.quantityButton}
                                    onPress={() => {
                                        const newQty = parseInt(quantity, 10) + 1;
                                        setQuantity(newQty.toString());
                                    }}
                                >
                                    <MaterialIcons name="add" size={24} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                            
                            <TouchableOpacity 
                                style={styles.addButton}
                                onPress={confirmAddItem}
                            >
                                <Text style={styles.addButtonText}>Add to List</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search item..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={COLORS.gray}
                            />
                            
                            <FlatList
                                data={availableStock.filter(s =>
                                    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    s.spare_id?.toLowerCase().includes(searchQuery.toLowerCase())
                                )}
                                keyExtractor={item => item.spare_id}
                                renderItem={({ item }) => {
                                    const alreadyAdded = selectedItems.some(i => i.spare_id === item.spare_id);
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.modalItem,
                                                alreadyAdded && styles.modalItemDisabled
                                            ]}
                                            onPress={() => !alreadyAdded && addItem(item)}
                                            disabled={alreadyAdded}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.modalItemText}>{item.name}</Text>
                                                <Text style={styles.modalItemSubtext}>
                                                    Available: {item.qty} | ₹{item.mrp?.toFixed(2)}
                                                    {alreadyAdded && ' (Already added)'}
                                                </Text>
                                            </View>
                                            {!alreadyAdded && (
                                                <MaterialIcons name="add-circle" size={24} color={COLORS.primary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
    
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }
    
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.dark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Courier</Text>
                <Text style={styles.headerSubtitle}>Step {step}/3</Text>
            </View>
            
            <View style={styles.progressBar}>
                {[1, 2, 3].map(i => (
                    <View
                        key={i}
                        style={[
                            styles.progressDot,
                            i <= step && styles.progressDotActive
                        ]}
                    />
                ))}
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </ScrollView>
            
            <View style={styles.footer}>
                {step > 1 && (
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setStep(step - 1)}
                    >
                        <Text style={styles.secondaryButtonText}>Back</Text>
                    </TouchableOpacity>
                )}
                
                {step < 3 ? (
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            (step === 1 && selectedTechs.length === 0) || 
                            (step === 2 && selectedItems.length === 0) 
                                ? styles.primaryButtonDisabled 
                                : null
                        ]}
                        onPress={() => setStep(step + 1)}
                        disabled={(step === 1 && selectedTechs.length === 0) || 
                                 (step === 2 && selectedItems.length === 0)}
                    >
                        <Text style={styles.primaryButtonText}>Next</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            submitting && styles.primaryButtonDisabled
                        ]}
                        onPress={handleCreateCourier}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.primaryButtonText}>Create Courier</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
            
            {renderTechModal()}
            {renderItemModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.light,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.dark,
        flex: 1,
        marginLeft: 12,
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.gray,
        fontWeight: '600',
    },
    progressBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.lightGray,
    },
    progressDotActive: {
        backgroundColor: COLORS.primary,
        width: 24,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    stepContainer: {
        marginBottom: 20,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
        marginBottom: 4,
    },
    stepSubtitle: {
        fontSize: 12,
        color: COLORS.gray,
        marginBottom: 16,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
        marginBottom: 16,
    },
    selectButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    selectedContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    selectedLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 12,
    },
    selectedItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: COLORS.light,
        borderRadius: 6,
        marginBottom: 8,
    },
    selectedItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.dark,
    },
    selectedItemSubtext: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 4,
    },
    reviewSection: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    reviewLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 8,
    },
    // Quantity Selector Styles
    quantityContainer: {
        padding: 16,
        alignItems: 'center',
    },
    selectedItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 8,
        textAlign: 'center',
    },
    availableText: {
        fontSize: 12,
        color: COLORS.gray,
        marginBottom: 24,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    quantityButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInput: {
        width: 60,
        height: 40,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        borderRadius: 8,
        textAlign: 'center',
        marginHorizontal: 12,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.dark,
    },
    addButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
    },
    addButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        textAlign: 'center',
    },
    modalItemDisabled: {
        opacity: 0.5,
    },
    reviewItem: {
        fontSize: 12,
        color: COLORS.dark,
        marginBottom: 6,
        paddingLeft: 8,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.lightGray,
        marginVertical: 8,
    },
    reviewTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.primary,
        paddingLeft: 8,
    },
    notesContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.dark,
        marginBottom: 8,
    },
    notesInput: {
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        borderRadius: 6,
        padding: 10,
        minHeight: 80,
        fontSize: 12,
        color: COLORS.dark,
        textAlignVertical: 'top',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.dark,
    },
    modalSearchInput: {
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
        fontSize: 14,
        color: COLORS.dark,
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    modalItemSelected: {
        backgroundColor: COLORS.light,
    },
    modalItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.dark,
    },
    modalItemSubtext: {
        fontSize: 11,
        color: COLORS.gray,
        marginTop: 4,
    },
    modalButton: {
        backgroundColor: COLORS.primary,
        marginHorizontal: 16,
        marginVertical: 12,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    secondaryButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 14,
    },
});
