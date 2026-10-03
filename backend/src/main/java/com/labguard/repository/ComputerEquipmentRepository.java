package com.labguard.repository;

import com.labguard.entity.ComputerEquipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComputerEquipmentRepository extends JpaRepository<ComputerEquipment, UUID> {
    List<ComputerEquipment> findByComputerIdAndStatus(UUID computerId, String status);

    @Query("SELECT ce FROM ComputerEquipment ce WHERE ce.computer.id = :computerId AND ce.slotType = :slotType AND ce.status = 'ACTIVE'")
    Optional<ComputerEquipment> findActiveByComputerIdAndSlotType(@Param("computerId") UUID computerId, @Param("slotType") String slotType);

    @Query("SELECT ce FROM ComputerEquipment ce WHERE ce.computer.lab.id = :labId AND ce.status = 'ACTIVE'")
    List<ComputerEquipment> findActiveByLabId(@Param("labId") UUID labId);
}
