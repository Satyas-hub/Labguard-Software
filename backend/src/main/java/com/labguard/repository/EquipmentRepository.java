package com.labguard.repository;

import com.labguard.entity.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, UUID> {
    Optional<Equipment> findByAssetId(String assetId);
    List<Equipment> findByType(String type);
    List<Equipment> findByStatus(String status);
}
