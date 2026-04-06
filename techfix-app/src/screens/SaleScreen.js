// E:\study\techfix\techfix-app\src\screens\SaleScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import client, { API_ENDPOINTS } from '../api/client';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

const DEMO_COMPANIES = [
  'Tech Solutions Pvt Ltd',
  'Digital Systems Inc',
  'Smart Devices Co',
  'Innovation Labs',
  'Future Tech Ltd'
];

export default function SaleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);
  
  // Form states
  const [saleType, setSaleType] = useState('direct');
  const [companyName, setCompanyName] = useState('');
  const [compliantNumber, setCompliantNumber] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [allProducts, setAllProducts] = useState([]);

  // Calculate total whenever selected products change
  useEffect(() => {
    const total = selectedProducts.reduce((sum, product) => {
      return sum + (product.mrp * product.quantity) + (product.serviceCharge || 0);
    }, 0);
    setTotalAmount(total);
  }, [selectedProducts]);

  // Search products from API
  useEffect(() => {
    if (productSearch.trim()) {
      searchProducts();
    } else {
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
  }, [productSearch, companyName]);

  const searchProducts = async () => {
    try {
      setLoading(true);
      const response = await client.get(API_ENDPOINTS.SEARCH_PRODUCTS, {
        params: {
          search: productSearch,
          company: companyName
        }
      });

      if (response.data.success) {
        setFilteredProducts(response.data.products);
        setShowProductDropdown(true);
      } else {
        console.error('Product search failed:', response.data.error);
        setFilteredProducts([]);
        setShowProductDropdown(false);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setFilteredProducts([]);
      setShowProductDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product) => {
    const existingProduct = selectedProducts.find(p => p.id === product.id);
    
    if (existingProduct) {
      // Update quantity if product already exists
      setSelectedProducts(prev => prev.map(p => 
        p.id === product.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      // Add new product
      setSelectedProducts(prev => [...prev, {
        ...product,
        quantity: 1,
        serviceCharge: 0
      }]);
    }
    
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const updateProductQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    } else {
      setSelectedProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, quantity } : p
      ));
    }
  };

  const updateServiceCharge = (productId, charge) => {
    const numericCharge = parseFloat(charge) || 0;
    setSelectedProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, serviceCharge: numericCharge } : p
    ));
  };

  const handleSubmit = async () => {
    try {
      // Validation
      if (!companyName) {
        Alert.alert('Error', 'Please select a company');
        return;
      }

      if (saleType === 'compliant' && !compliantNumber.trim()) {
        Alert.alert('Error', 'Please enter compliant number');
        return;
      }

      if (selectedProducts.length === 0) {
        Alert.alert('Error', 'Please add at least one product');
        return;
      }

      setSubmitting(true);

      const saleData = {
        type: saleType,
        company_name: companyName,
        compliant_number: compliantNumber || null,
        products: selectedProducts.map(p => ({
          product_id: p.id,
          product_name: p.name,
          product_code: p.code,
          quantity: p.quantity,
          mrp: p.mrp,
          service_charge: p.serviceCharge
        })),
        total_amount: totalAmount
      };

      console.log('Submitting sale request:', saleData);

      // API call to submit sale request
      const response = await client.post('/sales/requests/create/', saleData);

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Sale request submitted successfully! Waiting for admin approval.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setSaleType('direct');
                setCompanyName('');
                setCompliantNumber('');
                setProductSearch('');
                setSelectedProducts([]);
                setTotalAmount(0);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.data.error || 'Failed to submit sale request');
      }
    } catch (error) {
      console.error('Sale submission error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to submit sale request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Sale</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Form Content */}
        <TouchableOpacity 
          style={styles.formContainer}
          activeOpacity={1}
          onPress={() => {
            setShowCompanyDropdown(false);
            setShowProductDropdown(false);
          }}
        >
          {/* Type Dropdown */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Sale Type *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={(e) => {
                e?.stopPropagation?.();
                setSaleType(saleType === 'direct' ? 'compliant' : 'direct');
              }}
            >
              <Text style={styles.dropdownText}>
                {saleType === 'direct' ? 'Direct' : 'Compliant'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Company Dropdown */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Company Name *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={(e) => {
                e?.stopPropagation?.();
                setShowCompanyDropdown(!showCompanyDropdown);
              }}
            >
              <Text style={[styles.dropdownText, !companyName && styles.placeholderText]}>
                {companyName || 'Select Company'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.gray} />
            </TouchableOpacity>
            
            {showCompanyDropdown && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled={true} style={{maxHeight: 150}}>
                  {DEMO_COMPANIES.map((company, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        setCompanyName(company);
                        setShowCompanyDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{company}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Compliant Number (only for compliant type) */}
          {saleType === 'compliant' && (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Compliant Number *</Text>
              <TextInput
                style={styles.input}
                value={compliantNumber}
                onChangeText={setCompliantNumber}
                placeholder="Enter compliant number"
                placeholderTextColor={COLORS.gray}
              />
            </View>
          )}

          {/* Product Search */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Product Name/Code *</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.productSearch}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Type product name or code..."
                placeholderTextColor={COLORS.gray}
                onFocus={(e) => {
                  e?.stopPropagation?.();
                }}
              />
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <MaterialIcons name="search" size={20} color={COLORS.gray} />
              )}
            </View>
            
            {/* Product Dropdown */}
            {showProductDropdown && (
              <View style={styles.productDropdownList}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Searching products...</Text>
                  </View>
                ) : filteredProducts.length > 0 ? (
                  <ScrollView nestedScrollEnabled={true} style={{maxHeight: 180}}>
                    {filteredProducts.map((product) => (
                      <TouchableOpacity
                        key={`${product.id}-${Math.random()}`}
                        style={styles.productDropdownItem}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleProductSelect(product);
                        }}
                      >
                        <View>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productCode}>{product.code} - MRP: ₹{product.mrp} - Stock: {product.stock}</Text>
                        </View>
                        <MaterialIcons name="add-circle" size={24} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : productSearch.trim() ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No products found</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Selected Products List */}
          {selectedProducts.length > 0 && (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Selected Products</Text>
              {selectedProducts.map((product, index) => (
                <View key={`${product.id}-${index}`} style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productCode}>{product.code}</Text>
                    <Text style={styles.productMrp}>MRP: ₹{product.mrp}</Text>
                  </View>
                  
                  <View style={styles.productControls}>
                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateProductQuantity(product.id, product.quantity - 1)}
                      >
                        <MaterialIcons name="remove" size={18} color={COLORS.white} />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{product.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateProductQuantity(product.id, product.quantity + 1)}
                      >
                        <MaterialIcons name="add" size={18} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.serviceChargeControl}>
                      <Text style={styles.serviceChargeLabel}>Service Charge:</Text>
                      <TextInput
                        style={styles.serviceChargeInput}
                        value={product.serviceCharge.toString()}
                        onChangeText={(value) => updateServiceCharge(product.id, value)}
                        placeholder="0"
                        placeholderTextColor={COLORS.gray}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Total Amount */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} size="large" />
            ) : (
              <>
                <MaterialIcons name="send" size={24} color={COLORS.white} />
                <Text style={styles.submitButtonText}>Submit Sale Request</Text>
              </>
            )}
          </TouchableOpacity>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 16,
    flex: 1,
  },
  headerSpacer: {
    width: 28,
  },
  formContainer: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8,
  },
  dropdown: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 16,
    color: COLORS.dark,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.gray,
  },
  dropdownList: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  dropdownItemText: {
    fontSize: 16,
    color: COLORS.dark,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.dark,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  productSearch: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.dark,
  },
  productDropdownList: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
  },
  productCode: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  productMrp: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  productCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  productInfo: {
    marginBottom: 12,
  },
  productControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
    marginHorizontal: 16,
  },
  serviceChargeControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceChargeLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  serviceChargeInput: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: COLORS.dark,
    width: 80,
    textAlign: 'center',
  },
  totalContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: COLORS.gray,
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    color: COLORS.gray,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
